import { useMemo } from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    ScatterController,
    LineController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { paired, ols } from '../utils/stats';

ChartJS.register(
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    ScatterController,
    LineController
);

const LAG_LABELS = {
    0: '',
    1: '1m',
    12: '1y',
    24: '2y',
    60: '5y',
};

function shortTitle(seriesInfo, key) {
    return seriesInfo[key]?.title || key;
}

function laggedLabel(seriesInfo, key, lag) {
    const base = shortTitle(seriesInfo, key);
    return lag > 0 ? `${base} (t−${LAG_LABELS[lag] || lag})` : base;
}

function currentLabel(seriesInfo, key, lag) {
    const base = shortTitle(seriesInfo, key);
    return lag > 0 ? `${base} (t)` : base;
}

export function RegressionPanel({
    timeline,
    activeSeries,
    seriesInfo,
    lag,
    xKey,
    yKey,
    onAxesChange,
}) {
    const metrics = useMemo(
        () => Object.keys(activeSeries).filter((key) => activeSeries[key] && seriesInfo[key]),
        [activeSeries, seriesInfo]
    );

    const result = useMemo(() => {
        if (!xKey || !yKey || xKey === yKey) {
            return { insight: 'Choose two different metrics.', chart: null };
        }
        const xLabel = laggedLabel(seriesInfo, xKey, lag);
        const yLabel = currentLabel(seriesInfo, yKey, lag);
        const points = paired(timeline, xKey, yKey, lag);
        const fit = ols(points);
        if (!fit) {
            return { insight: 'Need at least 3 overlapping periods for regression.', chart: null };
        }

        const xs = points.map((p) => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const line = [
            { x: minX, y: fit.intercept + fit.slope * minX },
            { x: maxX, y: fit.intercept + fit.slope * maxX },
        ];
        const direction = fit.slope >= 0 ? 'higher' : 'lower';
        const strength = Math.abs(fit.r) >= 0.6 ? 'strong' : Math.abs(fit.r) >= 0.3 ? 'moderate' : 'weak';

        return {
            insight:
                `${yLabel} = ${fit.intercept.toFixed(2)} + ${fit.slope.toFixed(4)} × ${xLabel}. `
                + `R² = ${fit.r2?.toFixed(3) ?? '—'}, r = ${fit.r?.toFixed(3) ?? '—'}, n = ${fit.n}. `
                + `${strength[0].toUpperCase()}${strength.slice(1)} association: higher ${xLabel} tends to mean ${direction} ${yLabel}.`,
            chart: {
                data: {
                    datasets: [
                        {
                            type: 'scatter',
                            label: lag > 0 ? `${yLabel} vs ${xLabel}` : 'Periods',
                            data: points,
                            backgroundColor: 'rgba(56, 189, 248, 0.65)',
                            borderColor: '#38bdf8',
                            pointRadius: 3,
                            pointHoverRadius: 5,
                        },
                        {
                            type: 'line',
                            label: lag > 0 ? `Fit · lag ${LAG_LABELS[lag] || lag}` : 'Fit',
                            data: line,
                            borderColor: '#a78bfa',
                            backgroundColor: 'transparent',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#e2e8f0' },
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#f1f5f9',
                            bodyColor: '#e2e8f0',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            callbacks: {
                                label(ctx) {
                                    const point = ctx.raw;
                                    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                                        const xVal = Number(point.x).toFixed(2);
                                        const yVal = Number(point.y).toFixed(2);
                                        const when = point.date ? ` (${point.date})` : '';
                                        return `${xLabel}: ${xVal}%, ${yLabel}: ${yVal}%${when}`;
                                    }
                                    return ctx.dataset.label;
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            title: {
                                display: true,
                                text: `${xLabel} (%)`,
                                color: '#94a3b8',
                            },
                            ticks: {
                                color: '#94a3b8',
                                callback: (v) => `${v}%`,
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        },
                        y: {
                            title: {
                                display: true,
                                text: `${yLabel} (%)`,
                                color: '#94a3b8',
                            },
                            ticks: {
                                color: '#94a3b8',
                                callback: (v) => `${v}%`,
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        },
                    },
                },
            },
        };
    }, [timeline, seriesInfo, xKey, yKey, lag]);

    if (metrics.length < 2) {
        return (
            <section className="corr-panel glassmorphism" style={{ padding: '1.5rem 2rem', marginTop: '2rem' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>Regression</h3>
                <p className="corr-hint">Select at least two metrics for regression.</p>
            </section>
        );
    }

    return (
        <section className="corr-panel glassmorphism" style={{ padding: '1.5rem 2rem', marginTop: '2rem' }}>
            <div className="corr-panel-head">
                <div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>
                        Regression{lag > 0 ? ` · lag ${LAG_LABELS[lag] || lag}` : ''}
                    </h3>
                    <p className="corr-hint">
                        {lag > 0
                            ? `X is measured ${LAG_LABELS[lag] || lag} earlier than Y.`
                            : 'Scatter of monthly observations with OLS fit line.'}
                    </p>
                </div>
            </div>

            <div className="reg-controls">
                <label className="reg-field">
                    <span>{lag > 0 ? `X · t−${LAG_LABELS[lag] || lag}` : 'X (predictor)'}</span>
                    <select value={xKey || ''} onChange={(e) => onAxesChange(e.target.value, yKey)}>
                        {metrics.map((key) => (
                            <option key={key} value={key}>{laggedLabel(seriesInfo, key, lag)}</option>
                        ))}
                    </select>
                </label>
                <label className="reg-field">
                    <span>{lag > 0 ? 'Y · t' : 'Y (outcome)'}</span>
                    <select value={yKey || ''} onChange={(e) => onAxesChange(xKey, e.target.value)}>
                        {metrics.map((key) => (
                            <option key={key} value={key}>{currentLabel(seriesInfo, key, lag)}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="reg-chart-wrap">
                {result.chart ? (
                    <Chart type="scatter" data={result.chart.data} options={result.chart.options} />
                ) : (
                    <p className="corr-hint">{result.insight}</p>
                )}
            </div>

            {result.insight ? <div className="corr-insight">{result.insight}</div> : null}
        </section>
    );
}
