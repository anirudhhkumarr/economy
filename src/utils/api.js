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

export class ApiError extends Error {
    constructor(message, status, type) {
        super(message);
        this.status = status;
        this.type = type;
        this.name = 'ApiError';
    }
}

export class SchemaError extends ApiError {
    constructor(message) {
        super(message, null, 'SCHEMA_VALIDATION');
        this.name = 'SchemaError';
    }
}

let cachedBundle = null;

/** @internal test helper */
export function clearMacroBundleCache() {
    cachedBundle = null;
}

export async function loadMacroBundle() {
    if (cachedBundle) return cachedBundle;

    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}data/macro.json?_cb=${Date.now()}`;
    console.log('[ApiClient] Loading macro.json...');

    const response = await fetch(url);
    if (!response.ok) {
        throw new ApiError(`Failed to load macro data (${response.status})`, response.status, 'NETWORK');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        throw new ApiError('macro.json missing from deploy (got HTML). Run npm run data before build.', response.status, 'MISSING_DATA');
    }

    const json = await response.json();
    if (!json?.series || typeof json.series !== 'object') {
        throw new SchemaError('Malformed macro.json');
    }

    cachedBundle = json;
    console.log(`[ApiClient] Bundle from ${json.generatedAt || 'unknown'}; series=${Object.keys(json.series).join(',')}`);
    return json;
}
