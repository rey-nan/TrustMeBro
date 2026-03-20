import { useState, useEffect } from 'react';
import { api } from '../api/client';

type KnowledgeType = 'error' | 'success' | 'skill' | 'document' | 'fact' | 'preference';

interface KnowledgeEntry {
  id: string;
  agentId: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
}

interface Agent {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  errors: number;
  successes: number;
  mostUsed: number;
}

const TYPE_COLORS: Record<KnowledgeType, string> = {
  error: '#ff4444',
  success: '#00ff88',
  skill: '#4488ff',
  document: '#aa44ff',
  fact: '#ffaa00',
  preference: '#ff8844',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function KnowledgeBase() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('global');
  const [activeTab, setActiveTab] = useState<KnowledgeType | 'all'>('all');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, errors: 0, successes: 0, mostUsed: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newEntry, setNewEntry] = useState({
    type: 'skill' as KnowledgeType,
    title: '',
    content: '',
    tags: '',
    agentId: 'global',
  });

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    loadAgents();
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadEntries();
      loadStats();
    }
  }, [selectedAgent, activeTab]);

  useEffect(() => {
    if (debouncedSearch.length > 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  const loadAgents = async () => {
    const res = await api.get<Agent[]>('/api/agents');
    if (res.success && res.data) {
      setAgents(res.data ?? []);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    const typeParam = activeTab !== 'all' ? `&type=${activeTab}` : '';
    const res = await api.get<KnowledgeEntry[]>(`/api/knowledge?agentId=${selectedAgent}${typeParam}`);
    if (res.success && res.data) {
      setEntries(res.data ?? []);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await api.get<Stats>(`/api/knowledge/stats?agentId=${selectedAgent}`);
    if (res.success && res.data) {
      setStats(res.data);
    }
  };

  const performSearch = async () => {
    setIsSearching(true);
    const res = await api.post<SearchResult[]>('/api/knowledge/search', {
      query: debouncedSearch,
      agentId: selectedAgent !== 'global' ? selectedAgent : undefined,
      limit: 10,
    });
    if (res.success && res.data) {
      setSearchResults(res.data);
    }
    setIsSearching(false);
  };

  const handleAddEntry = async () => {
    const res = await api.post('/api/knowledge', {
      agentId: newEntry.agentId,
      type: newEntry.type,
      title: newEntry.title,
      content: newEntry.content,
      tags: newEntry.tags.split(',').map((t) => t.trim()).filter((t) => t),
    });

    if (res.success) {
      setShowAddModal(false);
      setNewEntry({ type: 'skill', title: '', content: '', tags: '', agentId: 'global' });
      loadEntries();
      loadStats();
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;

    const res = await api.delete(`/api/knowledge/${id}`);
    if (res.success) {
      loadEntries();
      loadStats();
    }
  };

  const filteredEntries = entries.filter((e) => activeTab === 'all' || e.type === activeTab);

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Knowledge Base</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--green)' }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Entries</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4444' }}>{stats.errors}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Errors</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#00ff88' }}>{stats.successes}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Successes</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--cyan)' }}>{stats.mostUsed}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Most Retrieved</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Filter by Agent
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="global">Global (All Agents)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            Semantic Search {isSearching && '(searching...)'}
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '8px 16px',
              background: 'var(--green)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            + Add Entry
          </button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>Search Results</h3>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--green)', borderRadius: 4, padding: 12 }}>
            {searchResults.map(({ entry, score }) => (
              <div
                key={entry.id}
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: TYPE_COLORS[entry.type],
                      borderRadius: 3,
                      color: entry.type === 'fact' || entry.type === 'skill' ? '#000' : '#fff',
                    }}>
                      {entry.type.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{entry.title}</span>
                  </div>
                  <span style={{ color: 'var(--cyan)', fontSize: 12 }}>
                    {Math.round(score * 100)}% relevant
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {entry.content.slice(0, 150)}{entry.content.length > 150 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
        {(['all', 'error', 'success', 'skill', 'document', 'fact', 'preference'] as const).map((tab) => (
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
            {tab === 'all' ? 'All' : tab + 's'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Loading...</div>
      ) : filteredEntries.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 48,
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
        }}>
          No entries found. Add some knowledge!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: TYPE_COLORS[entry.type],
                      borderRadius: 3,
                      color: entry.type === 'fact' || entry.type === 'skill' ? '#000' : '#fff',
                    }}>
                      {entry.type.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{entry.title}</span>
                    {entry.agentId !== 'global' && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        Agent: {entry.agentId}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {entry.content}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>Used {entry.usageCount} times</span>
                    <span>Created {formatDate(entry.createdAt)}</span>
                    {entry.tags.length > 0 && (
                      <span>Tags: {entry.tags.join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    border: '1px solid var(--red)',
                    color: 'var(--red)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: 24,
            width: 500,
            maxWidth: '90vw',
          }}>
            <h2 style={{ marginBottom: 16, color: 'var(--green)' }}>Add Knowledge Entry</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Type
              </label>
              <select
                value={newEntry.type}
                onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value as KnowledgeType })}
                style={{ width: '100%' }}
              >
                <option value="error">Error</option>
                <option value="success">Success</option>
                <option value="skill">Skill</option>
                <option value="document">Document</option>
                <option value="fact">Fact</option>
                <option value="preference">Preference</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Title
              </label>
              <input
                type="text"
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                placeholder="Entry title..."
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Content
              </label>
              <textarea
                value={newEntry.content}
                onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                placeholder="Detailed content..."
                style={{ width: '100%', minHeight: 100 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={newEntry.tags}
                onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                placeholder="tag1, tag2, tag3..."
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Agent
              </label>
              <select
                value={newEntry.agentId}
                onChange={(e) => setNewEntry({ ...newEntry, agentId: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="global">Global (All Agents)</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntry}
                disabled={!newEntry.title || !newEntry.content}
                style={{
                  padding: '8px 16px',
                  background: 'var(--green)',
                  color: 'var(--bg-primary)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  opacity: !newEntry.title || !newEntry.content ? 0.5 : 1,
                }}
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
