interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    description: string;
    model?: string;
    temperature?: number;
  };
  stats?: {
    totalTasks: number;
    successRate: number;
    avgDurationMs?: number;
  };
  onRunTask: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, stats, onRunTask, onEdit, onDelete }: AgentCardProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 'bold', color: 'var(--green)', marginBottom: 4 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{agent.description || 'No description'}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {agent.id.slice(0, 8)}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <div>Model: <span style={{ color: 'var(--text-primary)' }}>{agent.model || 'default'}</span></div>
        <div>Temp: <span style={{ color: 'var(--text-primary)' }}>{agent.temperature ?? 0.7}</span></div>
        {stats && (
          <>
            <div>Tasks: <span style={{ color: 'var(--text-primary)' }}>{stats.totalTasks}</span></div>
            <div>Success: <span style={{ color: stats.successRate > 0.8 ? 'var(--green)' : 'var(--yellow)' }}>
              {(stats.successRate * 100).toFixed(0)}%
            </span></div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRunTask}>Run Task</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete} className="danger">Delete</button>
      </div>
    </div>
  );
}
