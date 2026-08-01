import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export function TimelineChart({ data, activeSeries, seriesInfo }) {

    // Create datasets based on active filters
    const datasets = Object.keys(activeSeries)
        .filter(key => activeSeries[key])
        .map(key => {
            const info = seriesInfo[key];

            // Directly use the unified percentage/rate values
            const dataPoints = data.map(d => d[key]);

            return {
                label: info.title,
                data: dataPoints,
                borderColor: info.color,
                backgroundColor: `${info.color}11`,
                fill: false,
                tension: 0.4, // Smoother Bezier curves (addresses "boxy step" feedback)
                spanGaps: true,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: info.color,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                yAxisID: info.yAxisID || 'y',
            };
        });

    const chartData = {
        labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
        datasets
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                usePointStyle: true,
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(2) + '%';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false,
                },
                ticks: {
                    color: '#64748b',
                    maxTicksLimit: 12,
                    maxRotation: 0,
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#64748b',
                    callback: (value) => `${value}%`,
                    padding: 10
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    color: '#94a3b8',
                    callback: (value) => `${value}%`,
                    padding: 10
                }
            }
        }
    };


    return (
        <div className="chart-card glassmorphism hover-lift" style={{ height: '70vh', padding: '2rem' }}>
            <div className="chart-header">
                <h3 className="chart-title" style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>
                    Economic Indicator Trends
                </h3>
            </div>
            <div className="chart-body" style={{ marginTop: '1rem' }}>
                {datasets.length > 0 ? (
                    <Line options={options} data={chartData} />
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        Select at least one metric to display.
                    </div>
                )}
            </div>
        </div>
    );
}
