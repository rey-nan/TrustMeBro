import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';

interface Message {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  threadId?: string;
  delivered: boolean;
  read: boolean;
  createdAt: number;
}

interface Mention {
  id: number;
  mentionedAgentId: string;
  fromAgentId: string;
  messageId: string;
  delivered: boolean;
  createdAt: number;
}

interface Thread {
  id: string;
  title: string;
  taskId?: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface ThreadWithMessages {
  thread: Thread;
  messages: Message[];
}

interface Agent {
  id: string;
  name: string;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'agora';
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return new Date(ts).toLocaleDateString();
}

export function AgentInbox() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'mentions' | 'threads'>('inbox');
  const [inbox, setInbox] = useState<Message[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadWithMessages | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newMessageTo, setNewMessageTo] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      loadInbox();
      loadMentions();
      loadThreads();
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (lastMessage?.type === 'message:new') {
      const payload = lastMessage.payload as { toAgentId: string };
      if (payload.toAgentId === selectedAgentId) {
        loadInbox();
      }
      setUnreadCount((prev) => prev + 1);
    }
    if (lastMessage?.type === 'mention:new') {
      const payload = lastMessage.payload as { mentionedAgentId: string };
      if (payload.mentionedAgentId === selectedAgentId) {
        loadMentions();
      }
    }
  }, [lastMessage, selectedAgentId]);

  const loadAgents = async () => {
    const res = await api.get<Agent[]>('/api/agents');
    if (res.success && res.data && res.data.length > 0) {
      setAgents(res.data ?? []);
      const firstAgent = res.data[0];
      if (!selectedAgentId && firstAgent) {
        setSelectedAgentId(firstAgent.id);
      }
    }
  };

  const loadInbox = async () => {
    if (!selectedAgentId) return;
    const res = await api.get<Message[]>(`/api/agents/${selectedAgentId}/inbox`);
    if (res.success && res.data) {
      setInbox(res.data ?? []);
    }
  };

  const loadMentions = async () => {
    if (!selectedAgentId) return;
    const res = await api.get<Mention[]>(`/api/agents/${selectedAgentId}/mentions`);
    if (res.success && res.data) {
      setMentions(res.data ?? []);
    }
  };

  const loadThreads = async () => {
    const res = await api.get<{ type: string; agentId: string; content: string; id: string; createdAt: number }[]>('/api/threads');
    if (res.success && res.data) {
      const threadItems = (res.data ?? []).filter((item) => item.type === 'thread_created');
      const uniqueThreads = threadItems.reduce((acc, item) => {
        if (!acc.find((t) => t.id === item.id)) {
          acc.push({
            id: item.id,
            title: item.content.replace('Created thread: ', ''),
            participantIds: [],
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
          });
        }
        return acc;
      }, [] as Thread[]);
      setThreads(uniqueThreads);
    }
  };

  const loadThreadMessages = async (threadId: string) => {
    const res = await api.get<ThreadWithMessages>(`/api/threads/${threadId}`);
    if (res.success && res.data) {
      setSelectedThread(res.data ?? null);
    }
  };

  const sendMessage = async () => {
    if (!selectedAgentId || !newMessageTo || !newMessage) return;

    const res = await api.post(`/api/agents/${selectedAgentId}/messages`, {
      toAgentId: newMessageTo,
      content: newMessage,
    });

    if (res.success) {
      const toAgent = agents.find(a => a.id === newMessageTo);
      alert(`Message sent to ${toAgent?.name || newMessageTo}! Check their inbox to see it.`);
      setNewMessage('');
      setNewMessageTo('');
      loadInbox();
    }
  };

  const postToThread = async () => {
    if (!selectedThread || !selectedAgentId || !newMessage) return;

    const res = await api.post(`/api/threads/${selectedThread.thread.id}/messages`, {
      fromAgentId: selectedAgentId,
      content: newMessage,
    });

    if (res.success) {
      setNewMessage('');
      loadThreadMessages(selectedThread.thread.id);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Agent Inbox</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Select Agent
          </label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            style={{ width: 200 }}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
      </div>

      {unreadCount > 0 && (
        <div style={{
          padding: 12,
          background: 'rgba(0,255,136,0.1)',
          border: '1px solid var(--green)',
          borderRadius: 4,
          marginBottom: 16,
          color: 'var(--green)',
          fontSize: 13,
        }}>
          {unreadCount} unread message(s)
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 16,
        borderBottom: '1px solid var(--border-color)',
      }}>
        {(['inbox', 'mentions', 'threads'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--green)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--green)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
            {tab === 'inbox' && inbox.length > 0 && ` (${inbox.length})`}
            {tab === 'mentions' && mentions.length > 0 && ` (${mentions.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          {activeTab === 'inbox' && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              minHeight: 300,
            }}>
              {inbox.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No messages
                </div>
              ) : (
                inbox.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      padding: 12,
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--green)' }}>
                        @{msg.fromAgentId}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {formatRelativeTime(msg.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13 }}>{msg.content}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'mentions' && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              minHeight: 300,
            }}>
              {mentions.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No mentions
                </div>
              ) : (
                mentions.map((mention) => (
                  <div
                    key={mention.id}
                    style={{
                      padding: 12,
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--green)' }}>
                      @{mention.fromAgentId} mentioned you
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {formatRelativeTime(mention.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'threads' && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              minHeight: 300,
            }}>
              {threads.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No threads
                </div>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => loadThreadMessages(thread.id)}
                    style={{
                      padding: 12,
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{thread.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Created {formatRelativeTime(thread.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          {activeTab === 'threads' && selectedThread && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: 'var(--green)' }}>{selectedThread.thread.title}</h3>
                <button onClick={() => setSelectedThread(null)} style={{ fontSize: 11, padding: '4px 8px' }}>
                  Close
                </button>
              </div>
              <div style={{
                maxHeight: 200,
                overflow: 'auto',
                marginBottom: 16,
              }}>
                {selectedThread.messages.map((msg) => (
                  <div key={msg.id} style={{ marginBottom: 12, padding: 8, background: 'var(--bg-primary)', borderRadius: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>
                      @{msg.fromAgentId} • {formatRelativeTime(msg.createdAt)}
                    </div>
                    <div style={{ fontSize: 13 }}>{msg.content}</div>
                  </div>
                ))}
              </div>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Reply to thread..."
                style={{ minHeight: 60, marginBottom: 8 }}
              />
              <button onClick={postToThread} disabled={!newMessage}>
                Post Reply
              </button>
            </div>
          )}

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 16,
            marginTop: activeTab === 'threads' && selectedThread ? 16 : 0,
          }}>
            <h3 style={{ marginBottom: 12, color: 'var(--green)' }}>Send Message</h3>
            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              From: <strong>{agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId}</strong>
              {' → '}
              Message will appear in recipient's inbox
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                To Agent
              </label>
              <select value={newMessageTo} onChange={(e) => setNewMessageTo(e.target.value)}>
                <option value="">Select agent...</option>
                {agents.filter((a) => a.id !== selectedAgentId).map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Message
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                style={{ minHeight: 80 }}
              />
            </div>
            <button onClick={sendMessage} disabled={!newMessageTo || !newMessage}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
