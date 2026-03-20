import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { StatusBar } from '../components/StatusBar';
import { AgentCard } from '../components/AgentCard';
import { TaskList } from '../components/TaskList';
import { TraceLog } from '../components/TraceLog';
import { TaskForm } from '../components/TaskForm';

interface ActivityItem {
  id: number;
  type: string;
  agentId: string;
  message: string;
  metadata?: string;
  createdAt: number;
  seen: boolean;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  model?: string;
  temperature?: number;
}

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

interface Status {
  activeProvider: string;
  agentsRegistered: number;
  totalTasks: number;
  uptime: number;
}

interface HeartbeatStatus {
  agentId: string;
  cronExpression: string;
  lastWakeAt?: number;
  lastStatus?: 'ok' | 'worked' | 'error';
  nextWakeAt?: number;
  isActive: boolean;
}

export function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, { totalTasks: number; successRate: number }>>({});
  const [heartbeats, setHeartbeats] = useState<HeartbeatStatus[]>([]);
  const [awakeAgents, setAwakeAgents] = useState<Set<string>>(new Set());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'heartbeat:wake') {
      const payload = lastMessage.payload as { agentId: string };
      setAwakeAgents((prev) => new Set([...prev, payload.agentId]));
    }
    if (lastMessage?.type === 'heartbeat:sleep') {
      const payload = lastMessage.payload as { agentId: string };
      setAwakeAgents((prev) => {
        const next = new Set(prev);
        next.delete(payload.agentId);
        return next;
      });
    }
    if (lastMessage?.type?.startsWith('heartbeat')) {
      loadHeartbeats();
    }
    // Update tasks in real-time
    if (lastMessage?.type === 'task:completed' || lastMessage?.type === 'task:failed') {
      const { taskId, output, error } = lastMessage.payload as { taskId: string; output?: string; error?: string };
      setRecentTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: lastMessage.type === 'task:completed' ? 'success' : 'failed',
              output: output || t.output,
              error: error || t.error,
              duration_ms: Date.now() - t.created_at
            }
          : t
      ));
    }
  }, [lastMessage]);

  const loadData = async () => {
    const [statusRes, agentsRes, tasksRes, heartbeatsRes, activityRes] = await Promise.all([
      api.get<Status>('/api/status'),
      api.get<Agent[]>('/api/agents'),
      api.get<{ tasks: Task[] }>('/api/tasks?limit=10'),
      api.get<HeartbeatStatus[]>('/api/heartbeat'),
      api.get<{ items: ActivityItem[] }>('/api/activity?limit=10'),
    ]);

    if (statusRes.success && statusRes.data) setStatus(statusRes.data);
    if (agentsRes.success && agentsRes.data) {
      setAgents(agentsRes.data);
      for (const agent of agentsRes.data) {
        const statsRes = await api.get<{ totalTasks: number; successRate: number }>(`/api/agents/${agent.id}/stats`);
        if (statsRes.success && statsRes.data) {
          setAgentStats((prev) => ({ ...prev, [agent.id]: statsRes.data! }));
        }
      }
    }
    if (tasksRes.success && tasksRes.data) setRecentTasks(tasksRes.data.tasks ?? []);
    if (heartbeatsRes.success && heartbeatsRes.data) setHeartbeats(heartbeatsRes.data);
    if (activityRes.success && activityRes.data) setRecentActivity(activityRes.data.items ?? []);
  };

  const loadHeartbeats = async () => {
    const res = await api.get<HeartbeatStatus[]>('/api/heartbeat');
    if (res.success && res.data) setHeartbeats(res.data);
  };

  const handleWakeNow = async (agentId: string) => {
    await api.post(`/api/heartbeat/${agentId}/wake`);
  };

  const handleRunTask = (agentId: string) => {
    setSelectedAgentId(agentId);
    setShowTaskForm(true);
  };

  const runningTasks = recentTasks.filter((t) => t.status === 'running').length;

  const formatActivityTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'agent_message': return 'var(--green)';
      case 'thread_post': return 'var(--blue)';
      case 'mention': return 'var(--yellow)';
      case 'task_complete': return 'var(--cyan)';
      case 'heartbeat': return 'var(--purple)';
      default: return 'var(--text-secondary)';
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  const getHeartbeatStatusColor = (status?: string) => {
    switch (status) {
      case 'ok': return 'var(--green)';
      case 'worked': return 'var(--yellow)';
      case 'error': return 'var(--red)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>TrustMeBro Dashboard</h1>

      {status && (
        <StatusBar
          provider={status.activeProvider}
          agentCount={status.agentsRegistered}
          runningTasks={runningTasks}
          uptime={status.uptime}
        />
      )}

      {heartbeats.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: 16 }}>Heartbeat Monitor</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {heartbeats.map((hb) => {
              const agent = agents.find((a) => a.id === hb.agentId);
              const isAwake = awakeAgents.has(hb.agentId);

              return (
                <div
                  key={hb.agentId}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${isAwake ? 'var(--yellow)' : 'var(--border-color)'}`,
                    borderRadius: 4,
                    padding: 12,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--green)' }}>
                      {agent?.name || hb.agentId}
                    </div>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isAwake ? 'var(--yellow)' : 'var(--green)',
                      animation: isAwake ? 'pulse 1s infinite' : 'none',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Cron: <code style={{ color: 'var(--text-primary)' }}>{hb.cronExpression}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Last: </span>
                      <span style={{ color: getHeartbeatStatusColor(hb.lastStatus) }}>
                        {hb.lastStatus?.toUpperCase() || '-'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Next: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatTime(hb.nextWakeAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleWakeNow(hb.agentId)}
                    disabled={isAwake}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Wake Now
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0, fontSize: 16 }}>Recent Activity</h2>
            <button
              onClick={() => {}}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              Ver tudo →
            </button>
          </div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 12,
            maxHeight: 200,
            overflow: 'auto',
          }}>
            {recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getActivityColor(item.type),
                  marginTop: 6,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {item.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <span style={{ color: 'var(--green)' }}>{item.agentId}</span> • {formatActivityTime(item.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
        <div>
          <h2 style={{ marginBottom: 16, fontSize: 16 }}>Recent Tasks</h2>
          <TaskList tasks={recentTasks} />

          {showTaskForm && (
            <TaskForm
              agentId={selectedAgentId}
              onClose={() => setShowTaskForm(false)}
              onSuccess={() => { setShowTaskForm(false); loadData(); }}
            />
          )}
        </div>

        <div>
          <TraceLog />
        </div>
      </div>

      <h2 style={{ marginTop: 32, marginBottom: 16, fontSize: 16 }}>Registered Agents</h2>
      {agents.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
        }}>
          No agents registered yet. Create one in the Agents page.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              stats={agentStats[agent.id]}
              onRunTask={() => handleRunTask(agent.id)}
              onEdit={() => {}}
              onDelete={() => {}}
              onStop={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
