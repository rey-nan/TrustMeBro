import { useState, useEffect } from 'react';
import { api } from '../api/client';

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSkills, setAgentSkills] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [skillsRes, agentsRes] = await Promise.all([
      api.get<Skill[]>('/api/skills'),
      api.get<Agent[]>('/api/agents'),
    ]);

    if (skillsRes.success && skillsRes.data) {
      setSkills(skillsRes.data);
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
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Skills Management</h1>

      <div style={{ display: 'grid', gap: 24 }}>
        {skills.map((skill) => (
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

        {skills.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 48,
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
          }}>
            No skills registered
          </div>
        )}
      </div>
    </div>
  );
}
