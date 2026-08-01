import { useMemo } from 'react';
import { paired, pearson, heatColor } from '../utils/stats';

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

export function CorrelationPanel({ timeline, activeSeries, seriesInfo, lag, onPickRegression }) {
    const result = useMemo(() => {
        const keys = Object.keys(activeSeries).filter((key) => activeSeries[key] && seriesInfo[key]);
        if (keys.length < 2) {
            return { insight: 'Select at least two metrics for correlation.', matrix: null, pairs: [], keys: [] };
        }

        // Cell [row][col] = corr(col at t−lag, row at t).
        const matrix = keys.map((rowKey) =>
            keys.map((colKey) => {
                const points = paired(timeline, colKey, rowKey, lag);
                return pearson(
                    points.map((p) => p.x),
                    points.map((p) => p.y)
                );
            })
        );

        const pairs = [];
        for (let i = 0; i < keys.length; i += 1) {
            for (let j = 0; j < keys.length; j += 1) {
                if (i === j && lag === 0) continue;
                const r = matrix[i][j];
                if (r == null) continue;
                // For lag=0, only keep upper triangle to avoid duplicates
                if (lag === 0 && j <= i) continue;
                pairs.push({ x: keys[j], y: keys[i], r });
            }
        }
        pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
        const top = pairs[0];
        const lagTag = LAG_LABELS[lag] || `${lag}`;

        return {
            keys,
            matrix,
            pairs: pairs.slice(0, 5),
            insight: top
                ? `Strongest link: ${laggedLabel(seriesInfo, top.x, lag)} → ${currentLabel(seriesInfo, top.y, lag)} (r = ${top.r.toFixed(2)}). Click a cell to inspect with regression.`
                : 'Not enough overlapping periods to compute correlations.',
            lagTag,
        };
    }, [timeline, activeSeries, seriesInfo, lag]);

    return (
        <section className="corr-panel glassmorphism" style={{ padding: '1.5rem 2rem', marginTop: '2rem' }}>
            <div className="corr-panel-head">
                <div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>
                        Correlation{lag > 0 ? ` · lag ${LAG_LABELS[lag] || lag}` : ''}
                    </h3>
                    <p className="corr-hint">
                        {lag > 0
                            ? `Columns are predictors at t−${LAG_LABELS[lag] || lag}; rows are outcomes at t. Monthly periods.`
                            : 'Pearson relationships across selected metrics (same month).'}
                    </p>
                </div>
            </div>

            {result.matrix ? (
                <div className="heatmap-wrap">
                    <table className="heatmap">
                        <thead>
                            <tr>
                                <th>{lag > 0 ? `row (t) \\ col (t−${LAG_LABELS[lag] || lag})` : ''}</th>
                                {result.keys.map((key) => (
                                    <th key={key}>{laggedLabel(seriesInfo, key, lag)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {result.keys.map((rowKey, i) => (
                                <tr key={rowKey}>
                                    <th>{currentLabel(seriesInfo, rowKey, lag)}</th>
                                    {result.keys.map((colKey, j) => {
                                        const r = result.matrix[i][j];
                                        return (
                                            <td
                                                key={colKey}
                                                style={{ background: heatColor(r), cursor: onPickRegression ? 'pointer' : 'default' }}
                                                title={`${laggedLabel(seriesInfo, colKey, lag)} → ${currentLabel(seriesInfo, rowKey, lag)}`}
                                                onClick={() => onPickRegression?.(colKey, rowKey)}
                                            >
                                                {r == null ? '—' : r.toFixed(2)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="corr-hint">{result.insight}</p>
            )}

            {result.pairs.length > 0 && (
                <ul className="corr-pairs">
                    {result.pairs.map((pair) => (
                        <li key={`${pair.x}-${pair.y}`}>
                            {laggedLabel(seriesInfo, pair.x, lag)} → {currentLabel(seriesInfo, pair.y, lag)}: r ={' '}
                            {pair.r.toFixed(2)} ({pair.r >= 0 ? 'positive' : 'negative'})
                        </li>
                    ))}
                </ul>
            )}

            {result.matrix && result.insight ? <div className="corr-insight">{result.insight}</div> : null}
        </section>
    );
}
