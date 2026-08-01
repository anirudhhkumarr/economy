import { describe, it, expect, beforeEach } from 'vitest';
import { loadMacroBundle, clearMacroBundleCache } from './api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/**
 * Static data contract — macro.json is baked at build time (no runtime proxy).
 */

describe('Static macro bundle', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        clearMacroBundleCache();
        globalThis.fetch = async (url) => {
            if (String(url).includes('macro.json')) {
                const file = join(process.cwd(), 'public', 'data', 'macro.json');
                const body = readFileSync(file, 'utf8');
                return new Response(body, {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }
            return originalFetch(url);
        };
    });

    it('loads baked series with expected keys and history depth', async () => {
        // Clear module-level cache between runs by re-importing isn't needed if first call
        const bundle = await loadMacroBundle();
        expect(bundle.series).toBeTruthy();
        expect(Object.keys(bundle.series).length).toBeGreaterThanOrEqual(5);

        const sp = bundle.series.SP500;
        expect(sp).toBeTruthy();
        const spDates = Object.keys(sp).sort();
        expect(spDates[0] < '1950-01-01').toBe(true);
        expect(sp[spDates[spDates.length - 1]]).toBeGreaterThan(100);

        const gold = bundle.series.GOLD;
        expect(gold).toBeTruthy();
        const goldDates = Object.keys(gold).sort();
        expect(goldDates[0] < '1950-01-01').toBe(true);

        expect(bundle.series.FEDFUNDS).toBeTruthy();
        expect(bundle.series.DGS10).toBeTruthy();
    });
});
