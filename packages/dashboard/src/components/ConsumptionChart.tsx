interface DailyData {
  date: string;
  totalInput: number;
  totalOutput: number;
  taskCount: number;
}

interface ConsumptionChartProps {
  data: DailyData[];
}

export function ConsumptionChart({ data }: ConsumptionChartProps) {
  const last7Days = data.slice(-7).reverse();
  
  if (last7Days.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
      }}>
        No data for the last 7 days. Go run some tasks, champ.
      </div>
    );
  }

  const maxTokens = Math.max(...last7Days.map((d) => d.totalInput + d.totalOutput), 1);
  const height = 200;
  const barWidth = 40;
  const gap = 20;
  const chartWidth = last7Days.length * (barWidth + gap);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      padding: 16,
    }}>
      <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
        TOKEN USAGE (LAST 7 DAYS)
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <svg width={chartWidth} height={height + 40}>
          {last7Days.map((day, i) => {
            const total = day.totalInput + day.totalOutput;
            const barHeight = (total / maxTokens) * height;
            const x = i * (barWidth + gap);
            const y = height - barHeight;

            return (
              <g key={day.date}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="var(--green)"
                  rx={2}
                />
                <text
                  x={x + barWidth / 2}
                  y={height + 20}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize={10}
                >
                  {day.date.slice(5)}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={10}
                >
                  {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, background: 'var(--green)', borderRadius: 2 }} />
          <span style={{ color: 'var(--text-secondary)' }}>Total Tokens</span>
        </div>
      </div>
    </div>
  );
}
