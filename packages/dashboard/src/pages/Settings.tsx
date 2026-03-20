import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ProviderConfig } from '../components/ProviderConfig';
import { SandboxPlayground } from '../components/SandboxPlayground';

interface Status {
  version: string;
  activeProvider: string;
  agentsRegistered: number;
  totalTasks: number;
}

interface SandboxStatus {
  available: boolean;
  dockerVersion?: string;
  error?: string;
}

type ReasoningLevel = 'low' | 'medium' | 'high' | 'xhigh';

interface ReasoningConfig {
  planning: ReasoningLevel;
  execution: ReasoningLevel;
  verification: ReasoningLevel;
}

const LEVEL_INFO: Record<ReasoningLevel, { temp: number; multiplier: number; description: string }> = {
  low: { temp: 0.3, multiplier: 0.5, description: 'Rápido e econômico (menos tokens)' },
  medium: { temp: 0.5, multiplier: 0.75, description: 'Balanceado' },
  high: { temp: 0.7, multiplier: 1.0, description: 'Mais cuidadoso (mais tokens)' },
  xhigh: { temp: 0.9, multiplier: 1.5, description: 'Máximo raciocínio (muito mais tokens)' },
};

const REASONING_SANDWICH: ReasoningConfig = {
  planning: 'xhigh',
  execution: 'high',
  verification: 'xhigh',
};

export function Settings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiSecretKey, setApiSecretKey] = useState('');
  const [reasoningConfig, setReasoningConfig] = useState<ReasoningConfig>({
    planning: 'xhigh',
    execution: 'high',
    verification: 'xhigh',
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus | null>(null);

  useEffect(() => {
    loadStatus();
    loadReasoningBudget();
    loadSandboxStatus();
  }, []);

  const loadStatus = async () => {
    const res = await api.get<Status>('/api/status');
    if (res.success && res.data) setStatus(res.data);
  };

  const loadReasoningBudget = async () => {
    const res = await api.get<{ default: ReasoningConfig }>('/api/reasoning-budget');
    if (res.success && res.data?.default) {
      setReasoningConfig(res.data.default);
    }
  };

  const loadSandboxStatus = async () => {
    const res = await api.get<SandboxStatus>('/api/sandbox/status');
    if (res.success && res.data) {
      setSandboxStatus(res.data);
    }
  };

  const applyReasoningConfig = async () => {
    setSaving(true);
    setSaveMessage('');

    const res = await api.post('/api/reasoning-budget', {
      planning: reasoningConfig.planning,
      execution: reasoningConfig.execution,
      verification: reasoningConfig.verification,
    });

    setSaving(false);
    setSaveMessage(res.success ? 'Config saved successfully!' : `Error: ${res.error}`);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const applySandwich = () => {
    setReasoningConfig(REASONING_SANDWICH);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: 'var(--green)' }}>Settings</h1>

      <div style={{ maxWidth: 600 }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 24,
          marginBottom: 24,
        }}>
          <h2 style={{ marginBottom: 16, fontSize: 14 }}>System Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Version: </span>
              <span>{status?.version ?? '...'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Registered Agents: </span>
              <span>{status?.agentsRegistered ?? 0}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Total Tasks: </span>
              <span>{status?.totalTasks ?? 0}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Active Provider: </span>
              <span style={{ color: 'var(--green)' }}>{status?.activeProvider ?? '...'}</span>
            </div>
          </div>
        </div>

        <ProviderConfig
          currentProvider={status?.activeProvider ?? 'openrouter'}
          onSwitch={loadStatus}
        />

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 24,
          marginTop: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0, fontSize: 14 }}>Reasoning Budget</h2>
            <button
              onClick={applySandwich}
              style={{
                fontSize: 11,
                padding: '4px 12px',
                background: 'var(--green)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reasoning Sandwich
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Controls how much reasoning resources are allocated to each phase of task execution.
          </p>

          {(['planning', 'execution', 'verification'] as const).map((phase) => (
            <div key={phase} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ 
                  width: 100, 
                  fontSize: 13, 
                  textTransform: 'capitalize',
                  color: 'var(--text-primary)',
                }}>
                  {phase}
                </label>
                <select
                  value={reasoningConfig[phase]}
                  onChange={(e) => setReasoningConfig({
                    ...reasoningConfig,
                    [phase]: e.target.value as ReasoningLevel,
                  })}
                  style={{ flex: 1, maxWidth: 150 }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="xhigh">XHigh</option>
                </select>
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: 'var(--bg-primary)',
                  borderRadius: 3,
                  color: 'var(--cyan)',
                }}>
                  T={LEVEL_INFO[reasoningConfig[phase]].temp.toFixed(1)} ×{LEVEL_INFO[reasoningConfig[phase]].multiplier}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 100 }}>
                {LEVEL_INFO[reasoningConfig[phase]].description}
              </div>
            </div>
          ))}

          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 12,
            marginTop: 16,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Reasoning Sandwich: Planning (XHigh) → Execution (High) → Verification (XHigh)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Designed for maximum quality output with thorough verification before completion.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <button
              onClick={applyReasoningConfig}
              disabled={saving}
              style={{
                padding: '8px 24px',
                background: 'var(--green)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: 4,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
            {saveMessage && (
              <span style={{
                fontSize: 12,
                color: saveMessage.startsWith('Error') ? 'var(--red)' : 'var(--green)',
              }}>
                {saveMessage}
              </span>
            )}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 24,
          marginTop: 24,
        }}>
          <h2 style={{ marginBottom: 16, fontSize: 14 }}>API Security</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Set API_SECRET_KEY to protect your API endpoints. Clients must provide the x-api-key header.
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              API Secret Key (leave empty to disable auth)
            </label>
            <input
              type="password"
              value={apiSecretKey}
              onChange={(e) => setApiSecretKey(e.target.value)}
              placeholder="Set a strong secret key"
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Note: Changes require server restart. Edit .env file for permanent config.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 24,
          marginTop: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0, fontSize: 14 }}>Sandbox</h2>
            <button
              onClick={loadSandboxStatus}
              style={{
                fontSize: 11,
                padding: '4px 12px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Check Docker
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: sandboxStatus?.available ? 'var(--green)' : 'var(--red)',
            }} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13 }}>
                {sandboxStatus?.available ? 'Docker Available' : 'Docker Not Available'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {sandboxStatus?.dockerVersion || sandboxStatus?.error || 'Checking...'}
              </div>
            </div>
          </div>

          {!sandboxStatus?.available && (
            <div style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid var(--red)',
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: 'var(--red)' }}>Docker is required for sandboxed code execution.</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Install Docker from{' '}
                <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>
                  docs.docker.com/get-docker
                </a>
              </p>
            </div>
          )}

          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: 12,
            marginTop: 16,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Configuration (via .env):</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><code style={{ color: 'var(--green)' }}>SANDBOX_ENABLED=true</code> - Enable sandboxed bash execution</li>
            </ul>
          </div>
        </div>

        <SandboxPlayground />

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 24,
          marginTop: 24,
        }}>
          <h2 style={{ marginBottom: 16, fontSize: 14 }}>Environment Variables</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 8 }}>
              Configure these in your <code style={{ color: 'var(--green)' }}>.env</code> file:
            </p>
            <pre style={{
              background: 'var(--bg-primary)',
              padding: 16,
              borderRadius: 4,
              overflow: 'auto',
              fontSize: 11,
            }}>
{`# Server
PORT=3000
HOST=0.0.0.0

# LLM Provider
LLM_PROVIDER=openrouter
LLM_API_KEY=your-api-key
LLM_BASE_URL=
LLM_DEFAULT_MODEL=

# Security
API_SECRET_KEY=

# Storage
DB_PATH=./data/trustmebro.db`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
