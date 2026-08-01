import { useState, useEffect, useMemo } from 'react';
import { useMacroData } from '../hooks/useMacroData';
import { TimelineChart } from './TimelineChart';
import { CorrelationPanel } from './CorrelationPanel';
import { RegressionPanel } from './RegressionPanel';
import { Activity } from 'lucide-react';

const SERIES_INFO = {
    SP500: { title: 'S&P 500 (1M Return)', color: '#10b981', type: 'percent', yAxisID: 'y1' },
    UNRATE: { title: 'Unemployment Rate', color: '#f43f5e', type: 'percent', yAxisID: 'y' },
    CPI: { title: 'Inflation Rate (YoY)', color: '#f59e0b', type: 'percent', yAxisID: 'y' },
    GOLD: { title: 'Gold (1M Return)', color: '#eab308', type: 'percent', yAxisID: 'y1' },
    GDP: { title: 'Real GDP Growth (YoY)', color: '#3b82f6', type: 'percent', yAxisID: 'y' },
    FEDFUNDS: { title: 'Fed Funds Rate', color: '#8b5cf6', type: 'percent', yAxisID: 'y' },
    DGS1: { title: '1Y Treasury', color: '#06b6d4', type: 'percent', yAxisID: 'y' },
    DGS5: { title: '5Y Treasury', color: '#14b8a6', type: 'percent', yAxisID: 'y' },
    DGS10: { title: '10Y Treasury', color: '#0ea5e9', type: 'percent', yAxisID: 'y' },
    DGS30: { title: '30Y Treasury', color: '#6366f1', type: 'percent', yAxisID: 'y' },
};

const RANGES = ['1Y', '2Y', '5Y', '10Y', '15Y', '20Y', '30Y', '50Y', '100Y', 'MAX'];

const LAG_OPTIONS = [
    { label: 'None', months: 0 },
    { label: '1M', months: 1 },
    { label: '1Y', months: 12 },
    { label: '2Y', months: 24 },
    { label: '5Y', months: 60 },
];

export function Dashboard() {
    // By user request, enable all metrics by default
    const [activeSeries, setActiveSeries] = useState({
        SP500: true,
        UNRATE: true,
        CPI: true,
        GOLD: true,
        GDP: true,
        FEDFUNDS: true,
        DGS1: true,
        DGS5: true,
        DGS10: true,
        DGS30: true,
    });
    const [filterRange, setFilterRange] = useState('10Y');
    const [lag, setLag] = useState(0);
    const [regX, setRegX] = useState('FEDFUNDS');
    const [regY, setRegY] = useState('SP500');

    const { timeline, loading, error } = useMacroData(filterRange);

    const activeKeys = useMemo(
        () => Object.keys(activeSeries).filter((key) => activeSeries[key]),
        [activeSeries]
    );

    // Keep regression axes on currently enabled metrics
    useEffect(() => {
        if (activeKeys.length < 2) return;
        if (!activeKeys.includes(regX)) {
            setRegX(activeKeys.find((k) => k !== regY) || activeKeys[0]);
        }
        if (!activeKeys.includes(regY)) {
            setRegY(activeKeys.find((k) => k !== regX) || activeKeys[1] || activeKeys[0]);
        }
    }, [activeKeys, regX, regY]);

    const toggleSeries = (key) => {
        setActiveSeries(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const setRegAxes = (x, y) => {
        setRegX(x);
        setRegY(y);
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Gathering Macroeconomic Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-state glassmorphism">
                <h2>Data Fetch Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="dashboard-container" style={{ maxWidth: '100%' }}>
            <header className="dashboard-header glassmorphism">
                <div className="logo-group">
                    <Activity className="brand-icon pulse" />
                    <h1 className="brand-name">US Economy Pulse</h1>
                </div>
                <div className="header-meta">
                    <span className="live-indicator"><span className="dot"></span> Live Data</span>
                </div>
            </header>

            <div className="controls-ribbon glassmorphism" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '70px' }}>Metrics:</span>
                    {Object.entries(SERIES_INFO).map(([key, info]) => {
                        const isActive = activeSeries[key];
                        return (
                            <button
                                key={key}
                                onClick={() => toggleSeries(key)}
                                style={{
                                    background: isActive ? `${info.color}22` : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isActive ? info.color : 'rgba(255,255,255,0.1)'}`,
                                    color: isActive ? info.color : 'var(--text-muted)',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s ease',
                                }}
                                className="hover-lift"
                            >
                                {info.title}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '70px' }}>Range:</span>
                    {RANGES.map(range => {
                        const isActive = filterRange === range;
                        return (
                            <button
                                key={range}
                                onClick={() => setFilterRange(range)}
                                style={{
                                    background: isActive ? `rgba(56, 189, 248, 0.2)` : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.8)' : 'rgba(255,255,255,0.1)'}`,
                                    color: isActive ? '#38bdf8' : 'var(--text-muted)',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s ease',
                                }}
                                className="hover-lift"
                            >
                                {range}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '70px' }}>Lag:</span>
                    {LAG_OPTIONS.map(({ label, months }) => {
                        const isActive = lag === months;
                        return (
                            <button
                                key={label}
                                onClick={() => setLag(months)}
                                style={{
                                    background: isActive ? `rgba(167, 139, 250, 0.2)` : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isActive ? 'rgba(167, 139, 250, 0.8)' : 'rgba(255,255,255,0.1)'}`,
                                    color: isActive ? '#a78bfa' : 'var(--text-muted)',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s ease',
                                }}
                                className="hover-lift"
                            >
                                {label}
                            </button>
                        );
                    })}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
                        (correlation & regression · monthly periods)
                    </span>
                </div>
            </div>

            <main className="charts-grid-full">
                <TimelineChart
                    data={timeline}
                    activeSeries={activeSeries}
                    seriesInfo={SERIES_INFO}
                    filterRange={filterRange}
                />
                <CorrelationPanel
                    timeline={timeline}
                    activeSeries={activeSeries}
                    seriesInfo={SERIES_INFO}
                    lag={lag}
                    onPickRegression={setRegAxes}
                />
                <RegressionPanel
                    timeline={timeline}
                    activeSeries={activeSeries}
                    seriesInfo={SERIES_INFO}
                    lag={lag}
                    xKey={regX}
                    yKey={regY}
                    onAxesChange={setRegAxes}
                />
            </main>
        </div>
    );
}
