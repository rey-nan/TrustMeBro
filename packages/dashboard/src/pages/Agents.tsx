import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AgentCard } from '../components/AgentCard';
import { TaskForm } from '../components/TaskForm';

interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

interface Stats {
  totalTasks: number;
  successRate: number;
  avgDurationMs: number;
}

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [runTaskAgentId, setRunTaskAgentId] = useState<string | undefined>();
  const [showTaskForm, setShowTaskForm] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const res = await api.get<Agent[]>('/api/agents');
    if (res.success && res.data) {
      setAgents(res.data ?? []);
      for (const agent of (res.data ?? [])) {
        const statsRes = await api.get<Stats>(`/api/agents/${agent.id}/stats`);
        if (statsRes.success && statsRes.data) {
          setStats((prev) => ({ ...prev, [agent.id]: statsRes.data! }));
        }
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent? This action cannot be undone.')) return;
    await api.delete(`/api/agents/${id}`);
    loadAgents();
  };

  const handleStop = async (id: string) => {
    if (!confirm('Stop all running tasks for this agent?')) return;
    await api.post(`/api/agents/${id}/stop`, {});
    loadAgents();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--green)' }}>Agents</h1>
        <button onClick={() => setShowForm(true)}>Register Agent</button>
      </div>

      {showForm && (
        <AgentForm
          agent={editingAgent}
          onClose={() => { setShowForm(false); setEditingAgent(null); }}
          onSuccess={() => { setShowForm(false); setEditingAgent(null); loadAgents(); }}
        />
      )}

      {showTaskForm && (
        <TaskForm
          agentId={runTaskAgentId}
          onClose={() => setShowTaskForm(false)}
          onSuccess={() => setShowTaskForm(false)}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            stats={stats[agent.id]}
            onRunTask={() => { setRunTaskAgentId(agent.id); setShowTaskForm(true); }}
            onEdit={() => { setEditingAgent(agent); setShowForm(true); }}
            onDelete={() => handleDelete(agent.id)}
            onStop={() => handleStop(agent.id)}
          />
        ))}
      </div>

      {agents.length === 0 && (
        <div style={{
          padding: 48,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
        }}>
          No agents registered. Click "Register Agent" to create your first one.
        </div>
      )}
    </div>
  );
}

interface AgentFormProps {
  agent?: Agent | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AgentForm({ agent, onClose, onSuccess }: AgentFormProps) {
  const [form, setForm] = useState<Partial<Agent>>({
    id: agent?.id || '',
    name: agent?.name || '',
    description: agent?.description || '',
    systemPrompt: agent?.systemPrompt || '',
    model: agent?.model || '',
    temperature: agent?.temperature ?? 0.7,
    maxTokens: agent?.maxTokens ?? 2048,
    timeoutMs: agent?.timeoutMs ?? 60000,
    maxRetries: agent?.maxRetries ?? 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = {
      ...form,
      id: form.id || (form.name || 'agent').toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36),
    };

    const res = await api.post('/api/agents', data);
    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || 'Failed to save agent');
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
        width: 600,
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <h2 style={{ marginBottom: 24, color: 'var(--green)' }}>
          {agent ? 'Edit Agent' : 'Register Agent'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>ID (auto-generated if empty)</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="auto-generated"
                disabled={!!agent}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Awesome Agent"
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this agent does"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>System Prompt *</label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant that..."
              required
              style={{ minHeight: 120 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="gpt-3.5-turbo"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Max Tokens</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Timeout (ms)</label>
              <input
                type="number"
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Max Retries</label>
              <input
                type="number"
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid var(--red)',
              borderRadius: 4,
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
