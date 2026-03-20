import { useState } from 'react';

interface Task {
  id: string;
  agent_id: string;
  input: string;
  status: string;
  output?: string;
  error?: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  created_at: number;
}

interface TaskListProps {
  tasks: Task[];
  onAbort?: (taskId: string) => void;
  showPagination?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export function TaskList({ tasks, onAbort, showPagination, pagination }: TaskListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const truncate = (str: string, len: number) => {
    return str.length > len ? str.slice(0, len) + '...' : str;
  };

  if (tasks.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
      }}>
        No tasks yet. Your agents are bored. Give them work.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>ID</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>STATUS</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>DURATION</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>TOKENS</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>CREATED</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <>
                <tr
                  key={task.id}
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                >
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>{truncate(task.id, 12)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${task.status}`}>{task.status}</span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>{(task.duration_ms / 1000).toFixed(1)}s</td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>{task.input_tokens + task.output_tokens}</td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>{formatDate(task.created_at)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    {task.status === 'running' && onAbort && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAbort(task.id); }}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        Abort
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === task.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, background: 'var(--bg-primary)', fontSize: 12 }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Input:</strong>
                        <div style={{
                          marginTop: 4,
                          padding: 8,
                          background: 'var(--bg-secondary)',
                          borderRadius: 4,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 150,
                          overflow: 'auto',
                        }}>
                          {task.input}
                        </div>
                      </div>
                      {task.output && (
                        <div style={{ marginBottom: 8 }}>
                          <strong>Output:</strong>
                          <div style={{
                            marginTop: 4,
                            padding: 8,
                            background: 'var(--bg-secondary)',
                            borderRadius: 4,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 200,
                            overflow: 'auto',
                          }}>
                            {task.output}
                          </div>
                        </div>
                      )}
                      {task.error && (
                        <div>
                          <strong>Error:</strong>
                          <div style={{
                            marginTop: 4,
                            padding: 8,
                            background: 'rgba(255,68,68,0.1)',
                            borderRadius: 4,
                            color: 'var(--red)',
                          }}>
                            {task.error}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && pagination && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Prev
          </button>
          <span style={{ padding: '8px 16px' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
