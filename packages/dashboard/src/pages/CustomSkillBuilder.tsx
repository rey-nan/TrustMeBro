import { useState } from 'react';
import { api } from '../api/client';
import { TooltipField } from '../components/Tooltip';

interface CustomTool {
  name: string;
  description: string;
  inputSchema: {
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  executionType: 'bash' | 'node' | 'python' | 'http';
  executionCode: string;
  timeout: number;
}

interface CustomSkillBuilderProps {
  onClose: () => void;
  onSave: () => void;
  editSkill?: {
    id: string;
    name: string;
    description: string;
    tools: CustomTool[];
  };
}

export function CustomSkillBuilder({ onClose, onSave, editSkill }: CustomSkillBuilderProps) {
  const [name, setName] = useState(editSkill?.name || '');
  const [description, setDescription] = useState(editSkill?.description || '');
  const [tools, setTools] = useState<CustomTool[]>(
    editSkill?.tools || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<number | null>(null);

  const addTool = () => {
    setTools([...tools, {
      name: `tool_${tools.length + 1}`,
      description: '',
      inputSchema: { properties: {}, required: [] },
      executionType: 'bash',
      executionCode: '',
      timeout: 30000,
    }]);
    setExpandedTool(tools.length);
  };

  const removeTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const updateTool = (index: number, updates: Partial<CustomTool>) => {
    setTools(tools.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const addParameter = (toolIndex: number) => {
    const tool = tools[toolIndex];
    if (!tool) return;
    const paramName = `param_${Object.keys(tool.inputSchema.properties).length + 1}`;
    updateTool(toolIndex, {
      inputSchema: {
        ...tool.inputSchema,
        properties: {
          ...tool.inputSchema.properties,
          [paramName]: { type: 'string', description: '' },
        },
      },
    });
  };

  const removeParameter = (toolIndex: number, paramName: string) => {
    const tool = tools[toolIndex];
    if (!tool) return;
    const { [paramName]: _, ...rest } = tool.inputSchema.properties;
    updateTool(toolIndex, {
      inputSchema: {
        ...tool.inputSchema,
        properties: rest,
        required: tool.inputSchema.required.filter(r => r !== paramName),
      },
    });
  };

  const updateParameter = (toolIndex: number, oldName: string, newName: string, updates: { type?: string; description?: string }) => {
    const tool = tools[toolIndex];
    if (!tool) return;
    const props = { ...tool.inputSchema.properties };
    if (oldName !== newName) {
      const val = props[oldName];
      delete props[oldName];
      if (val) props[newName] = val;
    }
    if (updates.type && props[newName]) props[newName].type = updates.type;
    if (updates.description !== undefined && props[newName]) props[newName].description = updates.description;
    updateTool(toolIndex, {
      inputSchema: { ...tool.inputSchema, properties: props },
    });
  };

  const toggleRequired = (toolIndex: number, paramName: string) => {
    const tool = tools[toolIndex];
    if (!tool) return;
    const required = tool.inputSchema.required.includes(paramName)
      ? tool.inputSchema.required.filter(r => r !== paramName)
      : [...tool.inputSchema.required, paramName];
    updateTool(toolIndex, { inputSchema: { ...tool.inputSchema, required } });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (tools.length === 0) {
      setError('Add at least one tool');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = { name, description, tools };
      const res = editSkill
        ? await api.put(`/api/custom-skills/${editSkill.id}`, payload)
        : await api.post('/api/custom-skills', payload);

      if (res.success) {
        onSave();
      } else {
        setError(res.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const getPlaceholder = (type: string) => {
    switch (type) {
      case 'bash': return 'echo "Hello {{input.name}}"';
      case 'node': return 'console.log("Hello " + input.name)';
      case 'python': return 'print("Hello " + input.name)';
      case 'http': return 'https://api.example.com/greet?name={{input.name}}';
      default: return '';
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
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        padding: 24,
        borderRadius: 8,
        width: 800,
        maxWidth: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'var(--green)' }}>
            {editSkill ? 'Edit Custom Skill' : 'Create Custom Skill'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 24, cursor: 'pointer' }}>&times;</button>
        </div>

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

        <TooltipField label="Skill Name" tooltip="Nome da skill. Ex: Meu Scraper, API Interna" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Skill"
          />
        </TooltipField>

        <TooltipField label="Description" tooltip="Descreva o que essa skill faz">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this skill do?"
            style={{ minHeight: 60 }}
          />
        </TooltipField>

        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Tools ({tools.length})</h3>
            <button onClick={addTool} style={{ padding: '6px 16px', background: 'var(--green)', color: '#000', border: 'none', borderRadius: 4 }}>
              + Add Tool
            </button>
          </div>

          {tools.map((tool, toolIndex) => (
            <div key={toolIndex} style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              marginBottom: 12,
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setExpandedTool(expandedTool === toolIndex ? null : toolIndex)}
                style={{
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <span style={{ fontWeight: 'bold' }}>{tool.name || `Tool ${toolIndex + 1}`}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--cyan)' }}>{tool.executionType}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTool(toolIndex); }}
                    style={{ padding: '2px 8px', background: 'var(--red)', color: '#000', border: 'none', borderRadius: 4, fontSize: 11 }}
                  >
                    Remove
                  </button>
                  <span>{expandedTool === toolIndex ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedTool === toolIndex && (
                <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Tool Name</label>
                      <input
                        type="text"
                        value={tool.name}
                        onChange={(e) => updateTool(toolIndex, { name: e.target.value })}
                        placeholder="my_tool"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Execution Type</label>
                      <select
                        value={tool.executionType}
                        onChange={(e) => updateTool(toolIndex, { executionType: e.target.value as CustomTool['executionType'] })}
                      >
                        <option value="bash">Bash</option>
                        <option value="node">Node.js</option>
                        <option value="python">Python</option>
                        <option value="http">HTTP Request</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
                    <input
                      type="text"
                      value={tool.description}
                      onChange={(e) => updateTool(toolIndex, { description: e.target.value })}
                      placeholder="What does this tool do?"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Code ({tool.executionType})
                    </label>
                    <textarea
                      value={tool.executionCode}
                      onChange={(e) => updateTool(toolIndex, { executionCode: e.target.value })}
                      placeholder={getPlaceholder(tool.executionType)}
                      style={{ minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Use {`{{input.paramName}}`} to reference input parameters
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Timeout (ms)</label>
                    <input
                      type="number"
                      value={tool.timeout}
                      onChange={(e) => updateTool(toolIndex, { timeout: parseInt(e.target.value) || 30000 })}
                      style={{ width: 120 }}
                    />
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold' }}>Parameters</span>
                      <button
                        onClick={() => addParameter(toolIndex)}
                        style={{ padding: '2px 8px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
                      >
                        + Add Parameter
                      </button>
                    </div>

                    {Object.entries(tool.inputSchema.properties).map(([paramName, param]) => (
                      <div key={paramName} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={paramName}
                          onChange={(e) => updateParameter(toolIndex, paramName, e.target.value, {})}
                          placeholder="name"
                          style={{ width: 100 }}
                        />
                        <select
                          value={param.type}
                          onChange={(e) => updateParameter(toolIndex, paramName, paramName, { type: e.target.value })}
                          style={{ width: 80 }}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                        <input
                          type="text"
                          value={param.description}
                          onChange={(e) => updateParameter(toolIndex, paramName, paramName, { description: e.target.value })}
                          placeholder="Description"
                          style={{ flex: 1 }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={tool.inputSchema.required.includes(paramName)}
                            onChange={() => toggleRequired(toolIndex, paramName)}
                          />
                          Required
                        </label>
                        <button
                          onClick={() => removeParameter(toolIndex, paramName)}
                          style={{ padding: '2px 6px', background: 'var(--red)', color: '#000', border: 'none', borderRadius: 4, fontSize: 10 }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4 }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || tools.length === 0}
            style={{ padding: '10px 20px', background: 'var(--green)', color: '#000', border: 'none', borderRadius: 4, fontWeight: 'bold' }}
          >
            {saving ? 'Saving...' : 'Save Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}
