import { useState } from 'react';
import { api } from '../api/client';

interface TaskFormProps {
  agentId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskForm({ agentId: defaultAgentId, onClose, onSuccess }: TaskFormProps) {
  const [agentId, setAgentId] = useState(defaultAgentId || '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ taskId: string }>('/api/tasks', {
        agentId,
        input,
        priority: 'normal',
      });

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error || 'Failed to create task');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: 24,
        width: 500,
        maxWidth: '90vw',
      }}>
        <h2 style={{ marginBottom: 24, color: 'var(--green)' }}>Run Task</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              Agent ID
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent-id"
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              Task Input
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What should this agent do?"
              required
              style={{ minHeight: 150 }}
            />
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid var(--red)',
              borderRadius: 4,
              marginBottom: 16,
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Running...' : 'Execute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
