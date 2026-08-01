import { useState, useEffect, useMemo } from 'react';
import { loadMacroBundle, FRED_SERIES } from '../utils/api';

export function useMacroData(filterRange = 'MAX') {
    const [data, setData] = useState({
        raw: {},
        timeline: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load baked static macro.json once on mount
    useEffect(() => {
        let mounted = true;

        async function loadAllData() {
            setLoading(true);
            setError(null);
            try {
                const bundle = await loadMacroBundle();
                if (!mounted) return;

                const seriesData = bundle.series || {};
                const missing = bundle.errors?.length
                    ? bundle.errors
                    : Object.keys(FRED_SERIES).concat(['SP500', 'GOLD']).filter((k) => !seriesData[k]);

                if (Object.keys(seriesData).length === 0) {
                    setError('Macro data bundle is empty. Rebuild with npm run data.');
                } else if (missing.length > 0) {
                    console.warn(`[MacroData] Incomplete series: ${missing.join(', ')}`);
                }

                setData(prev => ({ ...prev, raw: seriesData }));
            } catch (err) {
                if (mounted) {
                    console.error('[MacroData] Critical Error:', err);
                    setError('The financial data bundle is currently unavailable. Please try again later.');
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadAllData();
        return () => { mounted = false; };
    }, []);


    // Compute transformations dynamically based on raw data and current filterRange
    const timeline = useMemo(() => {
        if (!data.raw || Object.keys(data.raw).length === 0) return [];

        let minDateStr = '9999-12-31';
        let maxDateStr = '0000-01-01';

        Object.values(data.raw).forEach(series => {
            const dates = Object.keys(series).sort();
            if (dates.length > 0) {
                if (dates[0] < minDateStr) minDateStr = dates[0];
                if (dates[dates.length - 1] > maxDateStr) maxDateStr = dates[dates.length - 1];
            }
        });

        if (minDateStr > maxDateStr) return [];

        // 1. Build Monthly Interpolated Map
        // We create a map of Month Strings (YYYY-MM) to interpolated values
        const keys = [...Object.keys(FRED_SERIES), 'SP500', 'GOLD'];
        const monthlyDataMap = new Map();

        // Standardize to the 1st of each month for the timeline
        const startUTC = new Date(minDateStr + 'T00:00:00Z');
        startUTC.setUTCDate(1);
        const endUTC = new Date(maxDateStr + 'T00:00:00Z');
        endUTC.setUTCDate(1);

        keys.forEach(key => {
            const series = data.raw[key] || {};
            const dates = Object.keys(series).sort();
            if (dates.length === 0) return;

            // Helper to get interpolated value for any specific date
            const getValAtDate = (targetDateStr) => {
                if (series[targetDateStr] !== undefined) return series[targetDateStr];

                // Find surround points
                let prevDate = null;
                let nextDate = null;
                for (let d of dates) {
                    if (d < targetDateStr) prevDate = d;
                    if (d > targetDateStr && !nextDate) nextDate = d;
                }

                if (!prevDate && !nextDate) return undefined;
                // Don't forward-fill before the series begins (avoids fake flat history)
                if (!prevDate) return undefined;
                // Hold last known value after the series ends
                if (!nextDate) return series[prevDate];

                const utcA = new Date(prevDate + 'T00:00:00Z');
                const utcB = new Date(nextDate + 'T00:00:00Z');
                const utcT = new Date(targetDateStr + 'T00:00:00Z');

                const totalDist = utcB - utcA;
                const pointDist = utcT - utcA;

                // Avoid division by zero if dates are the same (shouldn't happen with sorted unique dates)
                const progress = totalDist === 0 ? 0 : pointDist / totalDist;

                return series[prevDate] + progress * (series[nextDate] - series[prevDate]);
            };

            // Interpolate for every month in range
            let iter = new Date(startUTC);
            // Go back further for ROI calculation support
            iter.setUTCFullYear(iter.getUTCFullYear() - 2);

            while (iter <= endUTC) {
                const dStr = iter.toISOString().split('T')[0];
                const mKey = dStr.substring(0, 7); // YYYY-MM
                if (!monthlyDataMap.has(mKey)) monthlyDataMap.set(mKey, {});
                monthlyDataMap.get(mKey)[key] = getValAtDate(dStr);
                iter.setUTCMonth(iter.getUTCMonth() + 1);
            }
        });

        // 2. Continuous Monthly Timeline
        const AGGREGATE_1Y_SERIES = ['CPI', 'GDP'];
        const AGGREGATE_1M_SERIES = ['SP500', 'GOLD'];
        const RATE_SERIES = ['UNRATE', 'FEDFUNDS', 'DGS1', 'DGS5', 'DGS10', 'DGS30'];
        const processedTimeline = [];

        let iter = new Date(startUTC);
        while (iter <= endUTC) {
            const dStr = iter.toISOString().split('T')[0];
            const mKey = dStr.substring(0, 7);
            const currentVals = monthlyDataMap.get(mKey) || {};

            const processedDay = { date: dStr };

            // Rates (Unemployment)
            RATE_SERIES.forEach(key => {
                processedDay[key] = currentVals[key] || null;
            });

            // 1Y Rolling Return for Aggregates (CPI, GDP)
            const lookback1YIter = new Date(iter);
            lookback1YIter.setUTCFullYear(lookback1YIter.getUTCFullYear() - 1);
            const lookback1YMKey = lookback1YIter.toISOString().split('T')[0].substring(0, 7);
            const past1YVals = monthlyDataMap.get(lookback1YMKey) || {};

            AGGREGATE_1Y_SERIES.forEach(key => {
                const curr = currentVals[key];
                const past = past1YVals[key];
                if (curr != null && past != null && past !== 0) {
                    processedDay[key] = ((curr - past) / past) * 100;
                } else {
                    processedDay[key] = null;
                }
                processedDay[`${key}_raw`] = curr;
            });

            // 1M Rolling Return for Assets (SP500, GOLD)
            const lookback1MIter = new Date(iter);
            lookback1MIter.setUTCMonth(lookback1MIter.getUTCMonth() - 1);
            const lookback1MMKey = lookback1MIter.toISOString().split('T')[0].substring(0, 7);
            const past1MVals = monthlyDataMap.get(lookback1MMKey) || {};

            AGGREGATE_1M_SERIES.forEach(key => {
                const curr = currentVals[key];
                const past = past1MVals[key];
                if (curr != null && past != null && past !== 0) {
                    processedDay[key] = ((curr - past) / past) * 100;
                } else {
                    processedDay[key] = null;
                }
                processedDay[`${key}_raw`] = curr;
            });

            processedTimeline.push(processedDay);
            iter.setUTCMonth(iter.getUTCMonth() + 1);
        }

        // Filter for UI window
        let filterStartDateStr = '0000-01-01';
        if (filterRange !== 'MAX') {
            const yearsToSubtract = parseInt(filterRange.replace('Y', ''));
            if (!isNaN(yearsToSubtract)) {
                const d = new Date();
                d.setFullYear(d.getFullYear() - yearsToSubtract);
                filterStartDateStr = d.toISOString().split('T')[0];
            }
        }

        return processedTimeline.filter(d => d.date >= filterStartDateStr);

    }, [data.raw, filterRange]);

    return { raw: data.raw, timeline, loading, error };
}
