import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TooltipField } from '../components/Tooltip';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface SOUL {
  name: string;
  role: string;
  personality: string;
  expertise: string[];
  workStyle: string;
  values: string[];
  communicationStyle: string;
  limitations: string[];
}

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
    };
  }>;
}

interface AgentForm {
  name: string;
  role: string;
  description: string;
  level: 'intern' | 'specialist' | 'lead';
  departmentId: string;
  soul: SOUL;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  enableHeartbeat: boolean;
  heartbeatCron: string;
  enableWorkspace: boolean;
  skillIds: string[];
}

const PROVIDER_MODELS: Record<string, string> = {
  openrouter: 'openai/gpt-3.5-turbo',
  ollama: 'llama2',
  groq: 'mixtral-8x7b-32768',
  'openai-compatible': 'gpt-3.5-turbo',
};

export function AgentBuilder() {
  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [mode, setMode] = useState<'iniciante' | 'avancado'>('iniciante');

  const [form, setForm] = useState<AgentForm>({
    name: '',
    role: '',
    description: '',
    level: 'specialist',
    departmentId: '',
    soul: {
      name: '',
      role: '',
      personality: '',
      expertise: [],
      workStyle: '',
      values: [],
      communicationStyle: '',
      limitations: [],
    },
    provider: 'openrouter',
    model: PROVIDER_MODELS['openrouter'] ?? 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2048,
    timeoutMs: 60000,
    maxRetries: 3,
    enableHeartbeat: false,
    heartbeatCron: '*/15 * * * *',
    enableWorkspace: false,
    skillIds: [],
  });

  useEffect(() => {
    loadDepartments();
    loadSkills();
  }, []);

  const loadDepartments = async () => {
    const res = await api.get<Department[]>('/api/departments');
    if (res.success && res.data) {
      setDepartments(res.data);
    }
  };

  const loadSkills = async () => {
    const res = await api.get<Skill[]>('/api/skills');
    if (res.success && res.data) {
      setSkills(res.data);
    }
  };

  const handleGenerateSOUL = async () => {
    if (!form.name || !form.role) {
      setError('Name and role are required to generate SOUL');
      return;
    }

    setGenerating(true);
    setError(null);
    setGenerateSuccess(false);

    try {
      const res = await api.post<{ soul: SOUL; systemPrompt: string }>('/api/soul/generate', {
        name: form.name,
        role: form.role,
        description: form.description,
      });

      if (res.success && res.data) {
        setForm((prev) => ({
          ...prev,
          soul: res.data!.soul,
        }));
        setGenerateSuccess(true);
        setTimeout(() => {
          setStep(2);
          setGenerateSuccess(false);
        }, 800);
      } else {
        setError(res.error || 'Failed to generate SOUL');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const generateSystemPrompt = (): string => {
    const soul = form.soul;
    if (!soul.name) return '';

    return `# You are ${soul.name}, ${soul.role}

## Your Personality
${soul.personality || '...'}

## Your Expertise
${soul.expertise.length > 0 ? soul.expertise.map((e) => `- ${e}`).join('\n') : '- ...'}

## How You Work
${soul.workStyle || '...'}

## Your Values
${soul.values.length > 0 ? soul.values.map((v) => `- ${v}`).join('\n') : '- ...'}

## How You Communicate
${soul.communicationStyle || '...'}

## Your Limitations
${soul.limitations.length > 0 ? soul.limitations.map((l) => `- ${l}`).join('\n') : '- None specified'}`;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    const systemPrompt = generateSystemPrompt();
    const agentId = form.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);

    try {
      const res = await api.post('/api/agents', {
        id: agentId,
        name: form.name,
        description: form.description,
        systemPrompt,
        model: form.model || undefined,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        timeoutMs: form.timeoutMs,
        maxRetries: form.maxRetries,
        soul: form.soul,
        departmentId: form.departmentId || undefined,
        level: form.level,
        heartbeatCron: form.enableHeartbeat ? form.heartbeatCron : undefined,
        workspacePath: form.enableWorkspace ? `./data/workspaces/${form.name}` : undefined,
      });

      if (res.success) {
        if (form.enableHeartbeat) {
          await api.post('/api/heartbeat', {
            agentId,
            cronExpression: form.heartbeatCron,
          });
        }
        if (form.skillIds.length > 0) {
          await api.post(`/api/agents/${agentId}/skills`, {
            skillIds: form.skillIds,
          });
        }
        alert('✓ Agent created successfully!');
        window.location.hash = '#/agents';
        window.location.reload();
      } else {
        setError(res.error || 'Failed to create agent');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 'bold',
              background: step >= s ? 'var(--green)' : 'var(--bg-secondary)',
              color: step >= s ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {s}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
        Step {step} of 6
      </div>
      <div style={{
        marginTop: 8,
        height: 4,
        background: 'var(--bg-secondary)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(step / 6) * 100}%`,
          height: '100%',
          background: 'var(--green)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 style={{ marginBottom: 24 }}>Step 1: Identity</h2>
      <div style={{ display: 'grid', gap: 16 }}>
        <TooltipField label="Agent Name" tooltip="Nome único do agente. Usado como identificador no sistema." required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Max the Coder"
          />
        </TooltipField>
        <TooltipField label="Role" tooltip="Função principal do agente. Ex: Especialista em Backend, Analista de Marketing." required>
          <input
            type="text"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="e.g., Senior Software Engineer"
          />
        </TooltipField>
        <TooltipField label="Description" tooltip="Descreva o que esse agente faz. Quanto mais detalhado, melhor a SOUL gerada.">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this agent do?"
            style={{ minHeight: 80 }}
          />
        </TooltipField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <TooltipField label="Level" tooltip="Intern: precisa de aprovação. Specialist: age independente. Lead: pode delegar tarefas.">
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as 'intern' | 'specialist' | 'lead' })}
            >
              <option value="intern">Intern</option>
              <option value="specialist">Specialist</option>
              <option value="lead">Lead</option>
            </select>
          </TooltipField>
          <TooltipField label="Department" tooltip="Grupo organizacional ao qual o agente pertence.">
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">No Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </TooltipField>
        </div>
        <button 
          onClick={handleGenerateSOUL} 
          disabled={generating || !form.name || !form.role}
          style={{
            background: generateSuccess ? 'var(--green)' : undefined,
            color: generateSuccess ? '#000' : undefined,
          }}
        >
          {generating ? '⏳ Generating...' : generateSuccess ? '✓ SOUL Generated!' : '✨ Generate SOUL'}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 style={{ marginBottom: 24 }}>Step 2: Personality (SOUL)</h2>
      <div style={{ display: 'grid', gap: 16 }}>
        <TooltipField label="Personality" tooltip="Como o agente se comporta e se comunica. Define o 'caráter' dele.">
          <textarea
            value={form.soul.personality}
            onChange={(e) => setForm({ ...form, soul: { ...form.soul, personality: e.target.value } })}
            placeholder="Describe the agent's personality..."
            style={{ minHeight: 80 }}
          />
        </TooltipField>
        <TooltipField label="Expertise" tooltip="Áreas de conhecimento do agente. Separe por vírgula.">
          <input
            type="text"
            value={form.soul.expertise.join(', ')}
            onChange={(e) => setForm({
              ...form,
              soul: { ...form.soul, expertise: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
            })}
            placeholder="JavaScript, React, Node.js"
          />
        </TooltipField>
        <TooltipField label="Work Style" tooltip="Como o agente aborda os problemas. Ex: planeja antes de agir, verifica sempre.">
          <textarea
            value={form.soul.workStyle}
            onChange={(e) => setForm({ ...form, soul: { ...form.soul, workStyle: e.target.value } })}
            placeholder="How does this agent approach work?"
            style={{ minHeight: 60 }}
          />
        </TooltipField>
        <TooltipField label="Values" tooltip="Princípios que guiam as decisões do agente. Ex: qualidade, velocidade, segurança.">
          <input
            type="text"
            value={form.soul.values.join(', ')}
            onChange={(e) => setForm({
              ...form,
              soul: { ...form.soul, values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
            })}
            placeholder="Quality, Speed, Collaboration"
          />
        </TooltipField>
        <TooltipField label="Communication Style" tooltip="Como o agente escreve e se expressa nas respostas.">
          <textarea
            value={form.soul.communicationStyle}
            onChange={(e) => setForm({ ...form, soul: { ...form.soul, communicationStyle: e.target.value } })}
            placeholder="How does this agent communicate?"
            style={{ minHeight: 60 }}
          />
        </TooltipField>
        <TooltipField label="Limitations" tooltip="O que o agente NÃO deve fazer ou decidir sozinho.">
          <input
            type="text"
            value={form.soul.limitations.join(', ')}
            onChange={(e) => setForm({
              ...form,
              soul: { ...form.soul, limitations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
            })}
            placeholder="Cannot access internet, Limited context window"
          />
        </TooltipField>

        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            System Prompt Preview
          </div>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {generateSystemPrompt() || 'Fill in the fields above to see preview...'}
          </pre>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 style={{ marginBottom: 16 }}>Step 3: Model Configuration</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setMode('iniciante')}
          style={{
            padding: '6px 16px',
            background: mode === 'iniciante' ? 'var(--green)' : 'transparent',
            color: mode === 'iniciante' ? '#000' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
          }}
        >
          Iniciante
        </button>
        <button
          onClick={() => setMode('avancado')}
          style={{
            padding: '6px 16px',
            background: mode === 'avancado' ? 'var(--green)' : 'transparent',
            color: mode === 'avancado' ? '#000' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
          }}
        >
          Avançado
        </button>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <TooltipField label="Provider" tooltip="Serviço de LLM que o agente vai usar. OpenRouter recomendado para modelos gratuitos.">
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value, model: PROVIDER_MODELS[e.target.value] ?? '' })}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="groq">Groq</option>
            <option value="openai-compatible">OpenAI Compatible</option>
          </select>
        </TooltipField>
        <TooltipField label="Model" tooltip="Modelo específico de IA. Recomendado: xiaomi/mimo-v2-flash (gratuito e capaz).">
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder={`e.g., ${PROVIDER_MODELS[form.provider]}`}
          />
        </TooltipField>
        <TooltipField label={`Temperature: ${form.temperature}`} tooltip="0 = respostas precisas e previsíveis. 1 = respostas criativas e variadas.">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </TooltipField>
        {mode === 'avancado' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <TooltipField label="Max Tokens" tooltip="Tamanho máximo da resposta. 2048 é suficiente para maioria das tarefas.">
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })}
              />
            </TooltipField>
            <TooltipField label="Timeout (ms)" tooltip="Tempo máximo de espera em ms. 60000 = 60 segundos.">
              <input
                type="number"
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: parseInt(e.target.value) })}
              />
            </TooltipField>
            <TooltipField label="Max Retries" tooltip="Quantas vezes tentar novamente se falhar. 3 é um bom padrão.">
              <input
                type="number"
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) })}
              />
            </TooltipField>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 style={{ marginBottom: 24 }}>Step 4: Skills</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Assign tools and capabilities to this agent. Selected skills will be available during task execution.
      </p>
      {skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
          No skills available
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {skills.map((skill) => {
            const isActive = form.skillIds.includes(skill.id);
            return (
              <div
                key={skill.id}
                style={{
                  background: 'var(--bg-secondary)',
                  border: `2px solid ${isActive ? 'var(--green)' : 'var(--border-color)'}`,
                  borderRadius: 4,
                  padding: 16,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (isActive) {
                    setForm({ ...form, skillIds: form.skillIds.filter((id) => id !== skill.id) });
                  } else {
                    setForm({ ...form, skillIds: [...form.skillIds, skill.id] });
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {}}
                    style={{ width: 20, height: 20 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: isActive ? 'var(--green)' : 'var(--text-primary)' }}>
                      {skill.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {skill.description}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--cyan)' }}>
                    {skill.toolCount} tools
                  </span>
                </div>
                {isActive && skill.tools.length > 0 && (
                  <div style={{ marginTop: 12, marginLeft: 32 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Available tools:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {skill.tools.map((tool) => (
                        <span
                          key={tool.name}
                          title={tool.description}
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            background: 'var(--bg-primary)',
                            borderRadius: 3,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 style={{ marginBottom: 24 }}>Step 5: Autonomy</h2>
      <div style={{ display: 'grid', gap: 16 }}>
        {mode === 'avancado' && (
          <TooltipField label="Enable Heartbeat" tooltip="O agente acorda periodicamente para verificar se há trabalho. Útil para agentes autônomos.">
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 16,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.enableHeartbeat}
                  onChange={(e) => setForm({ ...form, enableHeartbeat: e.target.checked })}
                  style={{ width: 20, height: 20 }}
                />
                <div>
                  <div style={{ fontWeight: 'bold' }}>Enable Heartbeat</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Agent runs periodic checks/actions on a schedule
                  </div>
                </div>
              </label>
              {form.enableHeartbeat && (
                <div style={{ marginTop: 12 }}>
                  <TooltipField label="Cron Expression" tooltip="Expressão cron define quando o agente acorda. */15 * * * * = a cada 15 minutos.">
                    <input
                      type="text"
                      value={form.heartbeatCron}
                      onChange={(e) => setForm({ ...form, heartbeatCron: e.target.value })}
                      placeholder="*/15 * * * *"
                    />
                    <div style={{
                      marginTop: 8,
                      padding: 8,
                      background: 'var(--bg-primary)',
                      borderRadius: 4,
                      fontSize: 11,
                    }}>
                      <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>Quick presets:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[
                          { value: '*/15 * * * *', label: '15 min' },
                          { value: '*/30 * * * *', label: '30 min' },
                          { value: '0 * * * *', label: '1 hour' },
                          { value: '0 9 * * *', label: 'Daily 9am' },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => setForm({ ...form, heartbeatCron: preset.value })}
                            style={{ fontSize: 10, padding: '2px 6px' }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TooltipField>
                </div>
              )}
            </div>
          </TooltipField>
        )}

        <TooltipField label="Enable Workspace" tooltip="Cria uma pasta dedicada para o agente guardar memória e arquivos entre sessões.">
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 16,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.enableWorkspace}
                onChange={(e) => setForm({ ...form, enableWorkspace: e.target.checked })}
                style={{ width: 20, height: 20 }}
              />
              <div>
                <div style={{ fontWeight: 'bold' }}>Enable Workspace</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Agent has a dedicated folder for persistent memory and work files
                </div>
              </div>
            </label>
          </div>
        </TooltipField>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div>
      <h2 style={{ marginBottom: 24 }}>Step 6: Review & Create</h2>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
        }}>
          <h3 style={{ marginBottom: 12, color: 'var(--green)' }}>Agent Summary</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <div><strong>Name:</strong> {form.name}</div>
            <div><strong>Role:</strong> {form.role}</div>
            <div><strong>Level:</strong> {form.level}</div>
            <div><strong>Department:</strong> {departments.find((d) => d.id === form.departmentId)?.name || 'None'}</div>
            <div><strong>Provider:</strong> {form.provider}</div>
            <div><strong>Model:</strong> {form.model}</div>
            <div><strong>Temperature:</strong> {form.temperature}</div>
            <div><strong>Heartbeat:</strong> {form.enableHeartbeat ? `Yes (${form.heartbeatCron})` : 'No'}</div>
            <div><strong>Workspace:</strong> {form.enableWorkspace ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
        }}>
          <h3 style={{ marginBottom: 12, color: 'var(--green)' }}>System Prompt</h3>
          <pre style={{
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            maxHeight: 300,
            overflow: 'auto',
            background: 'var(--bg-primary)',
            padding: 12,
            borderRadius: 4,
          }}>
            {generateSystemPrompt()}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Agent Builder</h1>

      {renderStepIndicator()}

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: 24,
      }}>
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

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Previous
          </button>
          {step < 6 ? (
            <button onClick={() => setStep((s) => Math.min(6, s + 1))}>
              Next
            </button>
          ) : (
            <button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : '🚀 Create Agent'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
