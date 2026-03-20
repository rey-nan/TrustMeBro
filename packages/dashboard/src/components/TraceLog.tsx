import { useWebSocket } from '../hooks/useWebSocket';

export function TraceLog() {
  const { messages } = useWebSocket();

  const traces = messages
    .filter((m) => m.type.startsWith('task:') || m.type.startsWith('harness:'))
    .slice(-20)
    .reverse();

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 4,
      height: 300,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 12,
        fontWeight: 'bold',
        color: 'var(--green)',
      }}>
        TRACE LOG
      </div>
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 8,
        fontFamily: 'monospace',
        fontSize: 11,
      }}>
        {traces.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', padding: 8 }}>
            Waiting for events... No trace activity yet.
          </div>
        ) : (
          traces.map((trace, i) => (
            <div
              key={i}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: 8,
              }}
            >
              <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>
                {new Date(trace.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  color:
                    trace.type === 'task:completed' ? 'var(--green)' :
                    trace.type === 'task:failed' ? 'var(--red)' :
                    trace.type === 'task:started' ? 'var(--yellow)' :
                    'var(--text-primary)',
                  fontWeight: 'bold',
                  minWidth: 100,
                }}
              >
                {trace.type}
              </span>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {JSON.stringify(trace.payload).slice(0, 60)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
