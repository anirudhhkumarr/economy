/**
 * Fetches macro series and writes public/data/macro.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'macro.json');

const FRED_SERIES = {
    GDP: 'GDPC1',
    UNRATE: 'UNRATE',
    CPI: 'CPIAUCSL',
    FEDFUNDS: 'FEDFUNDS',
    DGS1: 'DGS1',
    DGS5: 'DGS5',
    DGS10: 'DGS10',
    DGS30: 'DGS30',
};

const UA = 'Mozilla/5.0 (compatible; EconomyDashboard/1.0; +https://github.com/anirudhhkumarr/economy)';

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.text();
}

async function fetchJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

function parseFredCsv(csv, seriesId) {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return {};
    const header = lines[0].split(',');
    const dateIdx = header.indexOf('observation_date');
    const valIdx = header.indexOf(seriesId);
    if (dateIdx < 0 || valIdx < 0) throw new Error(`Unexpected FRED header for ${seriesId}: ${lines[0]}`);

    const out = {};
    for (let i = 1; i < lines.length; i += 1) {
        const cols = lines[i].split(',');
        const date = cols[dateIdx];
        const raw = cols[valIdx];
        if (!date || !raw || raw === '.') continue;
        const num = parseFloat(raw);
        if (!Number.isNaN(num)) out[date] = num;
    }
    return out;
}

/** Keep last observation per YYYY-MM to shrink daily series. */
function toMonthly(priceMap) {
    const months = {};
    Object.keys(priceMap).sort().forEach((date) => {
        const key = `${date.slice(0, 7)}-01`;
        months[key] = priceMap[date];
    });
    return months;
}

async function fetchFred(seriesId) {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
    console.log(`[data] FRED ${seriesId}`);
    const csv = await fetchText(url);
    const raw = parseFredCsv(csv, seriesId);
    // Daily treasury yields → monthly; already-monthly series stay compact
    const dates = Object.keys(raw);
    const span = dates.length > 1 ? (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / dates.length : 30;
    const dayMs = 86400000;
    return span < dayMs * 10 ? toMonthly(raw) : raw;
}

async function fetchYahoo(symbol) {
    const period1 = Math.floor(Date.UTC(1900, 0, 1) / 1000);
    const period2 = Math.floor(Date.now() / 1000) + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
    console.log(`[data] Yahoo ${symbol}`);
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`Malformed Yahoo response for ${symbol}`);
    const quotes = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];
    const priceMap = {};
    timestamps.forEach((ts, i) => {
        const price = quotes?.close?.[i];
        if (price == null) return;
        const date = new Date((ts + 43200) * 1000).toISOString().slice(0, 10);
        priceMap[date] = price;
    });
    return toMonthly(priceMap);
}

async function fetchGold() {
    const sources = [
        'https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv',
        'https://cdn.jsdelivr.net/gh/datasets/gold-prices@master/data/monthly.csv',
    ];
    console.log('[data] Gold monthly');
    let lastErr;
    for (const url of sources) {
        try {
            const csv = await fetchText(url);
            const lines = csv.trim().split(/\r?\n/);
            const out = {};
            for (let i = 1; i < lines.length; i += 1) {
                const [month, price] = lines[i].split(',');
                if (!month || !price) continue;
                const date = month.length === 7 ? `${month}-01` : month;
                const num = parseFloat(price);
                if (!Number.isNaN(num)) out[date] = num;
            }
            if (Object.keys(out).length > 0) return out;
        } catch (e) {
            lastErr = e;
            console.warn(`[data] Gold source failed: ${e.message}`);
        }
    }
    throw lastErr || new Error('Gold history unavailable');
}

async function main() {
    const series = {};
    const errors = [];

    for (const [key, id] of Object.entries(FRED_SERIES)) {
        try {
            series[key] = await fetchFred(id);
            console.log(`  → ${key}: ${Object.keys(series[key]).length} pts`);
        } catch (e) {
            console.error(`  ✗ ${key}: ${e.message}`);
            errors.push(key);
        }
    }

    try {
        series.SP500 = await fetchYahoo('^GSPC');
        console.log(`  → SP500: ${Object.keys(series.SP500).length} pts`);
    } catch (e) {
        console.error(`  ✗ SP500: ${e.message}`);
        errors.push('SP500');
    }

    try {
        series.GOLD = await fetchGold();
        console.log(`  → GOLD: ${Object.keys(series.GOLD).length} pts`);
    } catch (e) {
        console.error(`  ✗ GOLD: ${e.message}`);
        errors.push('GOLD');
    }

    if (Object.keys(series).length === 0) {
        console.error('[data] No series fetched — aborting');
        process.exit(1);
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        series,
        errors,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload));
    const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
    console.log(`[data] Wrote ${OUT} (${kb} KB)${errors.length ? ` missing: ${errors.join(', ')}` : ''}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
