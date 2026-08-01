import Papa from 'papaparse';

export const FRED_SERIES = {
    GDP: 'GDPC1',
    UNRATE: 'UNRATE',
    CPI: 'CPIAUCSL',
    FEDFUNDS: 'FEDFUNDS',
    DGS1: 'DGS1',
    DGS5: 'DGS5',
    DGS10: 'DGS10',
    DGS30: 'DGS30',
};

/**
 * Principal-Grade Error Handling
 */
export class ApiError extends Error {
    constructor(message, status, type) {
        super(message);
        this.status = status;
        this.type = type;
        this.name = 'ApiError';
    }
}

export class RateLimitError extends ApiError {
    constructor(message, status = 429) {
        super(message, status, 'RATE_LIMIT');
        this.name = 'RateLimitError';
    }
}

export class SchemaError extends ApiError {
    constructor(message) {
        super(message, null, 'SCHEMA_VALIDATION');
        this.name = 'SchemaError';
    }
}

/**
 * Normalizes Fetch errors into deterministic types
 */
async function handleResponse(response, seriesId) {
    if (response.status === 429) {
        throw new RateLimitError(`Rate limited by upstream for ${seriesId}`);
    }
    if (!response.ok) {
        throw new ApiError(`Upstream failure: ${response.statusText}`, response.status, 'NETWORK');
    }

    // Check Content-Type to avoid "HTML Leakage" bugs (Vite proxy fallback)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        throw new ApiError(`Invalid response format (HTML received instead of Data). Check Proxy config.`, response.status, 'PROXY_MISCONFIG');
    }

    return response;
}

/**
 * Fetches stock/asset history from Yahoo Finance via internal proxy
 */
export async function fetchStockData(symbol, filterRange = 'MAX') {
    const nowEpoch = Math.floor(Date.now() / 1000) + 86400; // Add 1 day buffer
    // period1=0 is Unix epoch (1970) and truncates S&P history; request from 1900 for MAX
    let period1 = Math.floor(Date.UTC(1900, 0, 1) / 1000);
    let startDateStr = '';

    if (filterRange !== 'MAX') {
        const yearsToSubtract = parseInt(filterRange.replace('Y', ''));
        if (!isNaN(yearsToSubtract)) {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - yearsToSubtract);
            period1 = Math.floor(startDate.getTime() / 1000);
            startDateStr = startDate.toISOString().split('T')[0];
        }
    }

    // Using internal Vite/NGINX proxy at /economy/api/yahoo
    const API_BASE = '/economy/api';
    const endpoint = `${API_BASE}/yahoo/v8/finance/chart/${symbol}?period1=${period1}&period2=${nowEpoch}&interval=1d&events=history&includeAdjustedClose=true&_cb=${Date.now()}`;

    console.log(`[ApiClient] Requesting ${symbol}...`);

    try {
        const response = await fetch(endpoint).then(res => handleResponse(res, symbol));
        const json = await response.json();

        // Schema Validation
        if (!json?.chart?.result?.[0]) {
            throw new SchemaError(`Malformed Yahoo response for ${symbol}`);
        }

        const result = json.chart.result[0];
        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp;

        if (!quotes || !timestamps) {
            console.warn(`[ApiClient] No quote data for ${symbol}`);
            return {};
        }

        const priceMap = {};
        timestamps.forEach((ts, i) => {
            const price = quotes.close?.[i];
            if (price != null) {
                const date = new Date((ts + 43200) * 1000).toISOString().split('T')[0];
                if (!startDateStr || date >= startDateStr) {
                    priceMap[date] = price;
                }
            }
        });
        return priceMap;
    } catch (e) {
        console.error(`[ApiClient] ${symbol} failed:`, e.message);
        return null;
    }
}

/**
 * Fetches long-history gold prices (monthly LBMA, from 1833).
 * Yahoo GC=F only starts in 2000 — too short for macro charts.
 */
export async function fetchGoldData(filterRange = 'MAX') {
    let startDateStr = '';
    if (filterRange !== 'MAX') {
        const yearsToSubtract = parseInt(filterRange.replace('Y', ''));
        if (!isNaN(yearsToSubtract)) {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - yearsToSubtract);
            startDateStr = startDate.toISOString().split('T')[0];
        }
    }

    const sources = [
        'https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv',
        'https://cdn.jsdelivr.net/gh/datasets/gold-prices@master/data/monthly.csv',
    ];

    console.log('[ApiClient] Requesting gold monthly history...');

    for (const url of sources) {
        try {
            const response = await fetch(`${url}?_cb=${Date.now()}`).then((res) =>
                handleResponse(res, 'GOLD')
            );
            const csvContent = await response.text();
            const priceMap = await new Promise((resolve, reject) => {
                Papa.parse(csvContent, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const cleanData = {};
                        results.data.forEach((row) => {
                            const month = row['Date'] || row['date'];
                            const value = row['Price'] || row['price'];
                            if (!month || value == null || value === '') return;
                            const date = month.length === 7 ? `${month}-01` : month;
                            if (startDateStr && date < startDateStr) return;
                            const numVal = parseFloat(value);
                            if (!isNaN(numVal)) cleanData[date] = numVal;
                        });
                        resolve(cleanData);
                    },
                    error: (err) => reject(new SchemaError(`Gold CSV parse failed: ${err}`)),
                });
            });
            const n = Object.keys(priceMap).length;
            if (n > 0) {
                console.log(`[ApiClient] Gold history: ${n} months`);
                return priceMap;
            }
        } catch (e) {
            console.warn(`[ApiClient] Gold source failed (${url}):`, e.message);
        }
    }

    console.error('[ApiClient] Gold history unavailable');
    return null;
}

/**
 * Fetches macroeconomic data from FRED via internal proxy
 */
export async function fetchFredData(seriesId, filterRange = 'MAX') {
    let dateParam = '';
    let startDateStr = '';
    if (filterRange !== 'MAX') {
        const yearsToSubtract = parseInt(filterRange.replace('Y', ''));
        if (!isNaN(yearsToSubtract)) {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - yearsToSubtract);
            startDateStr = startDate.toISOString().split('T')[0];
            dateParam = `&cosd=${startDateStr}`;
        }
    }

    // Using internal Vite/NGINX proxy at /economy/api/fred
    const API_BASE = '/economy/api';
    const endpoint = `${API_BASE}/fred/graph/fredgraph.csv?id=${seriesId}${dateParam}`;

    console.log(`[ApiClient] Requesting ${seriesId}...`);

    try {
        const response = await fetch(endpoint).then(res => handleResponse(res, seriesId));
        const csvContent = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const cleanData = {};
                    results.data.forEach(row => {
                        const date = row['observation_date'];
                        const value = row[seriesId];
                        if (date && value && value !== '.') {
                            if (!startDateStr || date >= startDateStr) {
                                const numVal = parseFloat(value);
                                if (!isNaN(numVal)) {
                                    cleanData[date] = numVal;
                                }
                            }
                        }
                    });
                    resolve(cleanData);
                },
                error: (err) => {
                    reject(new SchemaError(`CSV Parse failed for ${seriesId}: ${err}`));
                }
            });
        });
    } catch (e) {
        console.error(`[ApiClient] ${seriesId} failed:`, e.message);
        return null;
    }
}

