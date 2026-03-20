import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ConsumptionChart } from '../components/ConsumptionChart';

interface DailyData {
  date: string;
  totalInput: number;
  totalOutput: number;
  taskCount: number;
}

interface SummaryItem {
  agent_id: string;
  model: string;
  provider: string;
  totalInput: number;
  totalOutput: number;
  taskCount: number;
}

interface TodayStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  taskCount: number;
  date: string;
}

export function Consumption() {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [monthly, setMonthly] = useState<{ total: TodayStats; daily: DailyData[] } | null>(null);
  const [summary, setSummary] = useState<{ byAgent: SummaryItem[]; totals: TodayStats } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [todayRes, monthRes, summaryRes] = await Promise.all([
      api.get<TodayStats>('/api/consumption/today'),
      api.get<{ total: TodayStats; daily: DailyData[] }>('/api/consumption/month'),
      api.get<{ byAgent: SummaryItem[]; totals: TodayStats }>('/api/consumption/summary'),
    ]);

    if (todayRes.success && todayRes.data) setToday(todayRes.data);
    if (monthRes.success && monthRes.data) setMonthly(monthRes.data);
    if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data ?? null);
    setLoading(false);
  };

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Token Consumption</h1>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading consumption data...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 20,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TODAY</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--green)' }}>
                {formatNumber(today?.totalTokens ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                tokens ({today?.taskCount ?? 0} tasks)
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 20,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>THIS MONTH</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--green)' }}>
                {formatNumber(monthly?.total.totalTokens ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                tokens ({monthly?.total.taskCount ?? 0} tasks)
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 20,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>ESTIMATED COST</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--yellow)' }}>
                $0.00
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                using free/local models
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <ConsumptionChart data={monthly?.daily ?? []} />
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 16,
          }}>
            <h2 style={{ marginBottom: 16, fontSize: 14 }}>Consumption by Agent & Model</h2>

            {summary?.byAgent.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                No consumption data yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>AGENT</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>MODEL</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>TASKS</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>INPUT</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>OUTPUT</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.byAgent.map((item) => (
                    <tr key={`${item.agent_id}-${item.model}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontSize: 12 }}>{item.agent_id.slice(0, 12)}</td>
                      <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-secondary)' }}>{item.model}</td>
                      <td style={{ padding: '8px', fontSize: 12, textAlign: 'right' }}>{item.taskCount}</td>
                      <td style={{ padding: '8px', fontSize: 12, textAlign: 'right' }}>{formatNumber(item.totalInput)}</td>
                      <td style={{ padding: '8px', fontSize: 12, textAlign: 'right' }}>{formatNumber(item.totalOutput)}</td>
                      <td style={{ padding: '8px', fontSize: 12, textAlign: 'right', color: 'var(--green)' }}>
                        {formatNumber(item.totalInput + item.totalOutput)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
