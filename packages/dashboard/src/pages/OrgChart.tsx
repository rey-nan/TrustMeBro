import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { TaskForm } from '../components/TaskForm';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  agentIds: string[];
  leadAgentId?: string;
  parentDeptId?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  soul?: {
    name: string;
    role: string;
    personality: string;
    expertise: string[];
  };
  level?: 'intern' | 'specialist' | 'lead';
}

interface OrgData {
  organization?: {
    name: string;
    ceoAgentId?: string;
  };
  departments: Department[];
  agents: Record<string, Agent>;
}

export function OrgChart() {
  const [orgData, setOrgData] = useState<OrgData>({ departments: [], agents: {} });
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [connectedAgents, setConnectedAgents] = useState<Set<string>>(new Set());

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadOrgData();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'task:started') {
      const payload = lastMessage.payload as { agentId: string };
      setConnectedAgents((prev) => new Set([...prev, payload.agentId]));
    }
    if (lastMessage?.type === 'task:completed' || lastMessage?.type === 'task:failed') {
      // For simplicity, we'll refresh after a delay
      setTimeout(() => loadOrgData(), 1000);
    }
  }, [lastMessage]);

  const loadOrgData = async () => {
    setLoading(true);
    const [deptRes, agentsRes, orgRes] = await Promise.all([
      api.get<Department[]>('/api/departments'),
      api.get<Agent[]>('/api/agents'),
      api.get<{ name: string; ceoAgentId?: string }>('/api/organization'),
    ]);

    if (deptRes.success && deptRes.data && agentsRes.success && agentsRes.data) {
      const agentsMap: Record<string, Agent> = {};
      for (const agent of (agentsRes.data ?? [])) {
        agentsMap[agent.id] = agent;
      }

      setOrgData({
        organization: orgRes.success && orgRes.data ? orgRes.data : undefined,
        departments: deptRes.data ?? [],
        agents: agentsMap,
      });
    }
    setLoading(false);
  };

  const getAgentById = (agentId: string): Agent | undefined => {
    return orgData.agents[agentId];
  };

  const getCEOAgent = (): Agent | undefined => {
    if (orgData.organization?.ceoAgentId) {
      return getAgentById(orgData.organization.ceoAgentId);
    }
    return undefined;
  };

  const getLevelBadge = (level?: string) => {
    const colors: Record<string, string> = {
      intern: '#888888',
      specialist: '#00ff88',
      lead: '#ffaa00',
    };
    return (
      <span style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: colors[level || 'specialist'] + '33',
        color: colors[level || 'specialist'],
      }}>
        {level?.toUpperCase() || 'SPECIALIST'}
      </span>
    );
  };

  const renderAgentCard = (agent: Agent, compact = false) => {
    const isRunning = connectedAgents.has(agent.id);
    return (
      <div
        key={agent.id}
        style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${isRunning ? 'var(--yellow)' : 'var(--border-color)'}`,
          borderRadius: 4,
          padding: compact ? 8 : 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
          minWidth: compact ? 120 : 150,
        }}
        onClick={() => setSelectedAgent(agent)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isRunning ? 'var(--yellow)' : 'var(--green)',
            animation: isRunning ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{ fontWeight: 'bold', fontSize: compact ? 11 : 12 }}>{agent.name}</span>
        </div>
        {!compact && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {agent.soul?.role || 'Agent'}
            </div>
            {getLevelBadge(agent.level)}
          </>
        )}
      </div>
    );
  };

  const renderDepartment = (dept: Department) => {
    const deptAgents = dept.agentIds.map((id) => getAgentById(id)).filter(Boolean) as Agent[];

    return (
      <div
        key={dept.id}
        style={{
          background: dept.color + '11',
          border: `2px solid ${dept.color}`,
          borderRadius: 8,
          padding: 16,
          minWidth: 200,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ fontWeight: 'bold', color: dept.color, fontSize: 14 }}>{dept.name}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setEditingDept(dept)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteDept(dept.id)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                background: 'transparent',
                border: '1px solid var(--red)',
                color: 'var(--red)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>{dept.description || 'No description'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {deptAgents.map((agent) => renderAgentCard(agent, true))}
          {deptAgents.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No agents yet
            </div>
          )}
        </div>
        {dept.leadAgentId && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
            Lead: {getAgentById(dept.leadAgentId)?.name || 'Unknown'}
          </div>
        )}
      </div>
    );
  };

  const renderModal = () => {
    if (!selectedAgent) return null;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
        onClick={() => setSelectedAgent(null)}
      >
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 24,
            width: 500,
            maxWidth: '90vw',
            maxHeight: '80vh',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ color: 'var(--green)', marginBottom: 4 }}>{selectedAgent.name}</h2>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {selectedAgent.soul?.role || 'Agent'}
              </div>
            </div>
            {getLevelBadge(selectedAgent.level)}
          </div>

          {selectedAgent.description && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13 }}>{selectedAgent.description}</div>
            </div>
          )}

          {selectedAgent.soul && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Personality</div>
                <div style={{ fontSize: 13 }}>{selectedAgent.soul.personality}</div>
              </div>

              {selectedAgent.soul.expertise.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Expertise</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {selectedAgent.soul.expertise.map((exp) => (
                      <span
                        key={exp}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                        }}
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button onClick={() => { setShowTaskForm(true); setSelectedAgent(null); }}>
              Run Task
            </button>
            <button onClick={() => setSelectedAgent(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteDept = async (deptId: string) => {
    if (!confirm('Delete this department? Agents will be unassigned.')) return;
    await api.delete(`/api/departments/${deptId}`);
    loadOrgData();
  };

  const renderDeptForm = () => {
    if (!showDeptForm && !editingDept) return null;

    const isEditing = !!editingDept;
    const dept = editingDept;

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
          <h2 style={{ marginBottom: 24, color: 'var(--green)' }}>
            {isEditing ? 'Edit Department' : 'Create Department'}
          </h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data = {
              name: formData.get('name'),
              description: formData.get('description'),
              color: formData.get('color'),
              leadAgentId: formData.get('leadAgentId') || undefined,
            };

            if (isEditing && dept) {
              await api.put(`/api/departments/${dept.id}`, data);
            } else {
              const deptId = (formData.get('name') as string).toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
              await api.post('/api/departments', { ...data, id: deptId });
            }

            setShowDeptForm(false);
            setEditingDept(null);
            loadOrgData();
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Name *</label>
              <input name="name" type="text" required placeholder="Engineering" defaultValue={dept?.name || ''} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Description</label>
              <input name="description" type="text" placeholder="What this department does" defaultValue={dept?.description || ''} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Color</label>
              <input name="color" type="color" defaultValue={dept?.color || '#00ff88'} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Lead Agent</label>
              <select name="leadAgentId" defaultValue={dept?.leadAgentId || ''}>
                <option value="">None</option>
                {Object.values(orgData.agents).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowDeptForm(false); setEditingDept(null); }}>Cancel</button>
              <button type="submit">{isEditing ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading organization...
      </div>
    );
  }

  const ceo = getCEOAgent();
  const departmentsWithoutParent = orgData.departments.filter((d) => !d.parentDeptId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--green)' }}>Organization Chart</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowDeptForm(true)}>Create Department</button>
        </div>
      </div>

      {showDeptForm && renderDeptForm()}
      {editingDept && renderDeptForm()}

      {showTaskForm && selectedAgent && (
        <TaskForm
          agentId={selectedAgent.id}
          onClose={() => setShowTaskForm(false)}
          onSuccess={() => { setShowTaskForm(false); loadOrgData(); }}
        />
      )}

      {selectedAgent && renderModal()}

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: 24,
        minHeight: 400,
      }}>
        {ceo && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>CEO</div>
            {renderAgentCard(ceo)}
          </div>
        )}

        {departmentsWithoutParent.length === 0 && !ceo && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 48 }}>
            No organization structure defined yet.
            <br />
            Create departments and set a CEO to build your org chart.
          </div>
        )}

        {departmentsWithoutParent.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {departmentsWithoutParent.map(renderDepartment)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 16, fontSize: 16 }}>All Agents</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {Object.values(orgData.agents).map((agent) => renderAgentCard(agent, true))}
        </div>
      </div>
    </div>
  );
}
