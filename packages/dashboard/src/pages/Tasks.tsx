import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TaskList } from '../components/TaskList';

interface Task {
  id: string;
  agent_id: string;
  input: string;
  status: string;
  output?: string;
  error?: string;
  attempts: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  created_at: number;
  completed_at?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [page, statusFilter, agentFilter]);

  const loadTasks = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
    });
    if (statusFilter) params.set('status', statusFilter);
    if (agentFilter) params.set('agentId', agentFilter);

    const res = await api.get<{ tasks: Task[]; pagination: Pagination }>(`/api/tasks?${params}`);
    if (res.success && res.data) {
      setTasks(res.data.tasks ?? []);
      setPagination(res.data.pagination ?? null);
    }
    setLoading(false);
  };

  const handleAbort = async (taskId: string) => {
    await api.post(`/api/tasks/${taskId}/abort`);
    loadTasks();
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Tasks</h1>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        padding: 16,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ width: 150 }}
          >
            <option value="">All</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Agent ID
          </label>
          <input
            type="text"
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            placeholder="Filter by agent"
            style={{ width: 200 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={loadTasks} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <TaskList
        tasks={tasks}
        onAbort={handleAbort}
        showPagination
        pagination={pagination ? {
          page: pagination.page,
          totalPages: pagination.totalPages,
          onPageChange: setPage,
        } : undefined}
      />
    </div>
  );
}
