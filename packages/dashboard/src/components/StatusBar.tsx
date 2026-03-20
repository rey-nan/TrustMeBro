interface StatusBarProps {
  provider: string;
  agentCount: number;
  runningTasks: number;
  uptime: number;
}

export function StatusBar({ provider, agentCount, runningTasks, uptime }: StatusBarProps) {
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      padding: 16,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      marginBottom: 24,
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>PROVIDER</div>
        <div style={{ color: 'var(--green)', fontWeight: 'bold' }}>{provider}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AGENTS</div>
        <div style={{ fontWeight: 'bold' }}>{agentCount}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>RUNNING</div>
        <div style={{ color: runningTasks > 0 ? 'var(--yellow)' : 'var(--text-primary)', fontWeight: 'bold' }}>
          {runningTasks}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>UPTIME</div>
        <div style={{ fontWeight: 'bold' }}>{formatUptime(uptime)}</div>
      </div>
    </div>
  );
}
