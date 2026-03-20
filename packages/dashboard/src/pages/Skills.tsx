import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CustomSkillBuilder } from './CustomSkillBuilder';

interface Skill {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  }>;
}

interface CustomSkill {
  id: string;
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    executionType: string;
    executionCode: string;
  }>;
}

interface Agent {
  id: string;
  name: string;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  toolCount: number;
}

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSkills, setAgentSkills] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSkill, setEditingSkill] = useState<CustomSkill | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [skillsRes, agentsRes, customRes] = await Promise.all([
      api.get<Skill[]>('/api/skills'),
      api.get<Agent[]>('/api/agents'),
      api.get<CustomSkill[]>('/api/custom-skills'),
    ]);

    if (skillsRes.success && skillsRes.data) {
      setSkills(skillsRes.data);
    }

    if (customRes.success && customRes.data) {
      setCustomSkills(customRes.data);
    }

    if (agentsRes.success && agentsRes.data) {
      setAgents(agentsRes.data);

      const skillsMap: Record<string, string[]> = {};
      for (const agent of agentsRes.data) {
        const res = await api.get<AgentSkill[]>(`/api/agents/${agent.id}/skills`);
        if (res.success && res.data) {
          skillsMap[agent.id] = res.data.map((s) => s.id);
        }
      }
      setAgentSkills(skillsMap);
    }

    setLoading(false);
  };

  const toggleAgentSkill = async (agentId: string, skillId: string) => {
    const currentSkills = agentSkills[agentId] ?? [];
    const hasSkill = currentSkills.includes(skillId);

    if (hasSkill) {
      await api.delete(`/api/agents/${agentId}/skills/${skillId}`);
    } else {
      await api.post(`/api/agents/${agentId}/skills`, {
        skillIds: [...currentSkills, skillId],
      });
    }

    await loadData();
  };

  const deleteCustomSkill = async (id: string) => {
    if (!confirm('Delete this custom skill?')) return;
    await api.delete(`/api/custom-skills/${id}`);
    await loadData();
  };

  const getSkillAgents = (skillId: string): number => {
    return Object.values(agentSkills).filter((skills) => skills.includes(skillId)).length;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--green)' }}>Skills Management</h1>
        {activeTab === 'custom' && (
          <button
            onClick={() => { setEditingSkill(null); setShowBuilder(true); }}
            style={{ padding: '8px 16px', background: 'var(--green)', color: '#000', border: 'none', borderRadius: 4, fontWeight: 'bold' }}
          >
            + New Custom Skill
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        {(['builtin', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--green)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--green)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {tab === 'builtin' ? `Built-in (${skills.length})` : `Custom (${customSkills.length})`}
          </button>
        ))}
      </div>

      {showBuilder && (
        <CustomSkillBuilder
          onClose={() => { setShowBuilder(false); setEditingSkill(null); }}
          onSave={() => { setShowBuilder(false); setEditingSkill(null); loadData(); }}
          editSkill={editingSkill ? {
            id: editingSkill.id,
            name: editingSkill.name,
            description: editingSkill.description,
            tools: editingSkill.tools.map(t => ({
              ...t,
              inputSchema: { properties: {}, required: [] as string[] },
              timeout: 30000,
              executionType: t.executionType as 'bash' | 'node' | 'python' | 'http',
            })),
          } : undefined}
        />
      )}

      <div style={{ display: 'grid', gap: 24 }}>
        {activeTab === 'builtin' && skills.map((skill) => (
          <div
            key={skill.id}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4, color: 'var(--green)' }}>{skill.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {skill.description}
                </p>
                <span style={{ fontSize: 11, color: 'var(--cyan)' }}>
                  Used by {getSkillAgents(skill.id)} agent(s) • {skill.toolCount} tool(s)
                </span>
              </div>
            </div>

            {skill.tools.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Tools:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {skill.tools.map((tool) => (
                    <div
                      key={tool.name}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <code style={{ color: 'var(--green)', fontSize: 13 }}>{tool.name}</code>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          ({Object.keys(tool.inputSchema.properties).join(', ')})
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {tool.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Assign to Agents:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {agents.map((agent) => {
                  const isActive = (agentSkills[agent.id] ?? []).includes(skill.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgentSkill(agent.id, skill.id)}
                      style={{
                        padding: '6px 12px',
                        background: isActive ? 'var(--green)' : 'transparent',
                        color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? 'var(--green)' : 'var(--border-color)'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {agent.name}
                    </button>
                  );
                })}
                {agents.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    No agents available
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'custom' && customSkills.map((skill) => (
          <div
            key={skill.id}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4, color: 'var(--green)' }}>{skill.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {skill.description}
                </p>
                <span style={{ fontSize: 11, color: 'var(--cyan)' }}>
                  {skill.tools.length} tool(s)
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setEditingSkill(skill); setShowBuilder(true); }}
                  style={{ padding: '4px 12px', fontSize: 12 }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteCustomSkill(skill.id)}
                  style={{ padding: '4px 12px', fontSize: 12, background: 'var(--red)', color: '#000', border: 'none', borderRadius: 4 }}
                >
                  Delete
                </button>
              </div>
            </div>

            {skill.tools.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Tools:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {skill.tools.map((tool) => (
                    <div
                      key={tool.name}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <code style={{ color: 'var(--green)', fontSize: 13 }}>{tool.name}</code>
                        <span style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 4,
                          color: 'var(--cyan)',
                        }}>
                          {tool.executionType}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {tool.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {activeTab === 'builtin' && skills.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
          }}>
            No built-in skills registered
          </div>
        )}

        {activeTab === 'custom' && customSkills.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
          }}>
            No custom skills yet. Click "+ New Custom Skill" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
