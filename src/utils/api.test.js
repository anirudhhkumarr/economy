import { describe, it, expect, beforeEach } from 'vitest';
import { fetchFredData, fetchStockData } from './api';

/**
 * Principal Engineering Logic Audit: LIVE INTEGRATION
 * 
 * CRITICAL: These tests hit actual endpoints on localhost:4173.
 * They verify the REAL Vite proxy configuration and REAL upstream data contracts.
 * NO MOCKS ALLOWED.
 */

const BASE_URL = 'http://localhost:4173';

describe('Live Endpoint Integration Audit', () => {

    // We use actual global fetch, not a mock.
    // However, Node's global fetch needs absolute URLs for localhost.
    // Our api.js uses relative paths. We must polyfill/monkey-patch fetch 
    // for this specific test environment to target the preview server.
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        globalThis.fetch = async (url, options) => {
            const absoluteUrl = url.startsWith('/') ? `${BASE_URL}${url}` : url;
            return originalFetch(absoluteUrl, options);
        };
    });

    describe('Actual FRED Data Contract', () => {
        it('fetches and parses REAL GDPC1 (Real GDP) from FRED', async () => {
            const result = await fetchFredData('GDPC1', '1Y');

            expect(result).not.toBeNull();
            const dates = Object.keys(result);
            expect(dates.length).toBeGreaterThan(0);

            // Verify value range (Real GDP should be > 10000)
            const firstValue = result[dates[0]];
            expect(firstValue).toBeGreaterThan(10000);
        });
    });

    describe('Actual Yahoo Finance Data Contract', () => {
        it('fetches and parses REAL Gold Spot Price JSON from Yahoo', async () => {
            const result = await fetchStockData('GC=F', '1Y');

            expect(result).not.toBeNull();
            const dates = Object.keys(result);
            expect(dates.length).toBeGreaterThan(200);

            // Verify value range (Gold should be > 500)
            const firstValue = result[dates[0]];
            expect(firstValue).toBeGreaterThan(500);
        });

        it('fetches long-history monthly gold prices', async () => {
            const { fetchGoldData } = await import('./api');
            const result = await fetchGoldData('MAX');

            expect(result).not.toBeNull();
            const dates = Object.keys(result).sort();
            expect(dates.length).toBeGreaterThan(1000);
            expect(dates[0] < '1950-01-01').toBe(true);
            expect(result[dates[dates.length - 1]]).toBeGreaterThan(500);
        });

        it('fetches and parses REAL S&P 500 Index from Yahoo (^GSPC)', async () => {
            const result = await fetchStockData('^GSPC', '1Y');

            expect(result).not.toBeNull();
            const dates = Object.keys(result);
            expect(dates.length).toBeGreaterThan(200);

            // Verify value range (S&P 500 should be > 1000)
            const firstValue = result[dates[0]];
            expect(firstValue).toBeGreaterThan(1000);
        });
    });

    describe('Architectural Integrity (The "Anti-HTML" Check)', () => {
        it('verifies that /api endpoints do NOT return the SPA index.html', async () => {
            // Using GDPC1 instead of SP500 as the valid series ID
            const response = await fetch('/economy/api/fred/graph/fredgraph.csv?id=GDPC1');
            const contentType = response.headers.get('content-type');
            const text = await response.text();

            expect(contentType).not.toContain('text/html');
            expect(text.trim()).not.toContain('<!doctype html>');
            expect(text.trim()).not.toContain('<html');
        });
    });
});
