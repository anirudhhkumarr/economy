function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pearson(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i += 1) {
        const a = xs[i] - mx;
        const b = ys[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
}

export function ols(points) {
    const n = points.length;
    if (n < 3) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i += 1) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
    }
    if (den === 0) return null;
    const slope = num / den;
    const intercept = my - slope * mx;
    const r = pearson(xs, ys);
    const ssTot = ys.reduce((sum, y) => sum + (y - my) ** 2, 0);
    const ssRes = points.reduce((sum, p) => sum + (p.y - (intercept + slope * p.x)) ** 2, 0);
    const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot;
    return { slope, intercept, r, r2, n };
}

/**
 * Pair X (lagged) with Y (current).
 * offset=1 means X is the previous period's value.
 */
export function paired(rows, xKey, yKey, offset = 0) {
    const lag = Math.max(0, Number(offset) || 0);
    const points = [];
    for (let i = lag; i < rows.length; i += 1) {
        const x = rows[i - lag][xKey];
        const y = rows[i][yKey];
        if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({
                x,
                y,
                date: rows[i].date,
                xDate: rows[i - lag].date,
            });
        }
    }
    return points;
}

export function heatColor(r) {
    if (r == null) return 'transparent';
    const t = Math.max(-1, Math.min(1, r));
    if (t >= 0) {
        const a = 0.12 + 0.55 * t;
        return `rgba(16, 185, 129, ${a})`;
    }
    const a = 0.12 + 0.55 * -t;
    return `rgba(244, 63, 94, ${a})`;
}
