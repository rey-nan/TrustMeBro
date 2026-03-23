import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';

interface ActivityItem {
  id: string;
  type: 'message_sent' | 'mention' | 'thread_created' | 'task_completed' | 'heartbeat';
  agentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

const TYPE_COLORS: Record<string, string> = {
  message_sent: '#4488ff',
  mention: '#00ff88',
  thread_created: '#ffaa00',
  task_completed: '#00ff88',
  heartbeat: '#888888',
};

const TYPE_ICONS: Record<string, string> = {
  message_sent: '💬',
  mention: '@',
  thread_created: '🧵',
  task_completed: '✅',
  heartbeat: '💤',
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'agora';
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return new Date(ts).toLocaleDateString();
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [agents, setAgents] = useState<string[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadActivities();
    loadAgents();

    const savedCount = localStorage.getItem('activityUnseenCount');
    if (savedCount) {
      setUnseenCount(parseInt(savedCount, 10));
    }
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'activity:new') {
      const payload = lastMessage.payload as ActivityItem;
      setActivities((prev) => [payload, ...prev.slice(0, 99)]);
      setUnseenCount((prev) => {
        const newCount = prev + 1;
        localStorage.setItem('activityUnseenCount', String(newCount));
        return newCount;
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    if (activities.length > 0) {
      setUnseenCount(0);
      localStorage.setItem('activityUnseenCount', '0');
    }
  }, [activities]);

  const loadActivities = async () => {
    setLoading(true);
    const res = await api.get<ActivityItem[]>('/api/activity?limit=100');
    if (res.success && res.data) {
      setActivities(res.data ?? []);
    }
    setLoading(false);
  };

  const loadAgents = async () => {
    const res = await api.get<Array<{ id: string; name: string }>>('/api/agents');
    if (res.success && res.data) {
      setAgents(res.data.map((a) => a.id));
    }
  };

  const filteredActivities = activities.filter((item) => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (agentFilter && item.agentId !== agentFilter) return false;
    return true;
  });

  const getAgentInitial = (agentId: string): string => {
    return agentId.charAt(0).toUpperCase();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--green)' }}>Activity Feed</h1>
        {unseenCount > 0 && (
          <div style={{
            background: 'var(--red)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 'bold',
          }}>
            {unseenCount} novo(s)
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        padding: 16,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Type
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 150 }}>
            <option value="all">All</option>
            <option value="message_sent">Messages</option>
            <option value="mention">Mentions</option>
            <option value="thread_created">Threads</option>
            <option value="task_completed">Tasks</option>
            <option value="heartbeat">Heartbeats</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Agent
          </label>
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={{ width: 150 }}>
            <option value="">All Agents</option>
            {agents.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
          <button onClick={loadActivities} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
      }}>
        {filteredActivities.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No activity yet. Make some agents work!
          </div>
        ) : (
          filteredActivities.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 16,
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: TYPE_COLORS[item.type] + '33',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: TYPE_COLORS[item.type],
                  flexShrink: 0,
                }}>
                  {getAgentInitial(item.agentId)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: TYPE_COLORS[item.type] + '22',
                      color: TYPE_COLORS[item.type],
                    }}>
                      {TYPE_ICONS[item.type]} {item.type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      @{item.agentId}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: expandedItem === item.id ? 'pre-wrap' : 'nowrap',
                  }}>
                    {item.content.includes('@') ? (
                      <span dangerouslySetInnerHTML={{
                        __html: item.content.replace(
                          /@([a-zA-Z0-9_-]+)/g,
                          '<span style="color: var(--green)">@$1</span>'
                        ),
                      }} />
                    ) : (
                      item.content
                    )}
                  </div>
                  {expandedItem === item.id && item.metadata && (
                    <div style={{
                      marginTop: 8,
                      padding: 8,
                      background: 'var(--bg-primary)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}>
                      {JSON.stringify(item.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
