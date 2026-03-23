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

interface MetaConfig {
  soulExtras: string;
  model: string;
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

const colors = {
  surface: '#131313',
  surfaceCard: '#353534',
  primary: '#00f2ff',
  primaryText: '#e1fdff',
  onSurface: '#e5e2e1',
  onSurfaceDim: '#b9cacb',
  green: '#4ae176',
  red: '#ff4444',
  outline: '#3a494b',
  display: "'Space Grotesk', sans-serif",
};

type SettingsTab = 'system' | 'meta-agent' | 'reasoning' | 'sandbox' | 'env';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'meta-agent', label: 'Meta-Agent' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'env', label: 'Env Vars' },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');
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

  // Meta-Agent config
  const [metaConfig, setMetaConfig] = useState<MetaConfig>({ soulExtras: '', model: '' });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaveMessage, setMetaSaveMessage] = useState('');

  useEffect(() => {
    loadStatus();
    loadReasoningBudget();
    loadSandboxStatus();
    loadMetaConfig();
  }, []);

  const loadStatus = async () => {
    const res = await api.get<Status>('/api/status');
    if (res.success && res.data) setStatus(res.data);
  };

  const loadReasoningBudget = async () => {
    const res = await api.get<{ default: ReasoningConfig }>('/api/reasoning-budget');
    if (res.success && res.data?.default) setReasoningConfig(res.data.default);
  };

  const loadSandboxStatus = async () => {
    const res = await api.get<SandboxStatus>('/api/sandbox/status');
    if (res.success && res.data) setSandboxStatus(res.data);
  };

  const loadMetaConfig = async () => {
    try {
      const res = await api.get<MetaConfig>('/api/meta/config');
      if (res.success && res.data) {
        setMetaConfig({
          soulExtras: (res.data as any).soulExtras || '',
          model: (res.data as any).model || '',
        });
      }
    } catch {}
  };

  const saveMetaConfig = async () => {
    setMetaSaving(true);
    setMetaSaveMessage('');
    const res = await api.put('/api/meta/config', metaConfig);
    setMetaSaving(false);
    setMetaSaveMessage(res.success ? 'Saved!' : `Error: ${res.error}`);
    setTimeout(() => setMetaSaveMessage(''), 3000);
  };

  const applyReasoningConfig = async () => {
    setSaving(true);
    setSaveMessage('');
    const res = await api.post('/api/reasoning-budget', reasoningConfig);
    setSaving(false);
    setSaveMessage(res.success ? 'Config saved successfully!' : `Error: ${res.error}`);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const cardStyle = {
    background: colors.surfaceCard,
    borderRadius: 8,
    padding: 24,
    marginBottom: 20,
  };

  const labelStyle = {
    fontSize: 12,
    color: colors.onSurfaceDim,
    marginBottom: 6,
    display: 'block' as const,
  };

  const renderSystemTab = () => (
    <>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 16, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>System Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: colors.onSurfaceDim }}>Version: </span>{status?.version ?? '...'}</div>
          <div><span style={{ color: colors.onSurfaceDim }}>Agents: </span>{status?.agentsRegistered ?? 0}</div>
          <div><span style={{ color: colors.onSurfaceDim }}>Tasks: </span>{status?.totalTasks ?? 0}</div>
          <div><span style={{ color: colors.onSurfaceDim }}>Provider: </span><span style={{ color: colors.green }}>{status?.activeProvider ?? '...'}</span></div>
        </div>
      </div>

      <ProviderConfig currentProvider={status?.activeProvider ?? 'openrouter'} onSwitch={loadStatus} />

      <div style={cardStyle}>
        <h2 style={{ marginBottom: 16, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>API Security</h2>
        <p style={{ fontSize: 12, color: colors.onSurfaceDim, marginBottom: 16 }}>
          Set API_SECRET_KEY to protect your API endpoints.
        </p>
        <label style={labelStyle}>API Secret Key</label>
        <input type="password" value={apiSecretKey} onChange={(e) => setApiSecretKey(e.target.value)} placeholder="Set a strong secret key" />
      </div>
    </>
  );

  const renderMetaAgentTab = () => (
    <>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 8, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Meta-Agent Personality</h2>
        <p style={{ fontSize: 12, color: colors.onSurfaceDim, marginBottom: 16 }}>
          Base SOUL is hardcoded. This adds extra traits on top.
        </p>

        <label style={labelStyle}>Soul Extras (additional personality traits)</label>
        <textarea
          value={metaConfig.soulExtras}
          onChange={(e) => setMetaConfig({ ...metaConfig, soulExtras: e.target.value })}
          placeholder="e.g., Be more formal with clients. Avoid Skynet jokes in serious contexts."
          style={{ minHeight: 120 }}
        />

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Model Override</label>
          <input
            value={metaConfig.model}
            onChange={(e) => setMetaConfig({ ...metaConfig, model: e.target.value })}
            placeholder="e.g., openai/gpt-4o"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button onClick={saveMetaConfig} disabled={metaSaving} className="primary">
            {metaSaving ? 'Saving...' : 'Save Meta Config'}
          </button>
          {metaSaveMessage && (
            <span style={{ fontSize: 12, color: metaSaveMessage.startsWith('Error') ? colors.red : colors.green }}>
              {metaSaveMessage}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const renderReasoningTab = () => (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ marginBottom: 0, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Reasoning Budget</h2>
        <button onClick={() => setReasoningConfig(REASONING_SANDWICH)} style={{ fontSize: 11, padding: '4px 12px', background: colors.green, color: colors.surface, border: 'none', borderRadius: 4 }}>
          Reasoning Sandwich
        </button>
      </div>

      {(['planning', 'execution', 'verification'] as const).map((phase) => (
        <div key={phase} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ width: 100, fontSize: 13, textTransform: 'capitalize' as const }}>{phase}</label>
            <select
              value={reasoningConfig[phase]}
              onChange={(e) => setReasoningConfig({ ...reasoningConfig, [phase]: e.target.value as ReasoningLevel })}
              style={{ flex: 1, maxWidth: 150 }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">XHigh</option>
            </select>
            <span style={{ fontSize: 10, padding: '2px 6px', background: colors.surface, borderRadius: 3, color: colors.primary }}>
              T={LEVEL_INFO[reasoningConfig[phase]].temp.toFixed(1)} ×{LEVEL_INFO[reasoningConfig[phase]].multiplier}
            </span>
          </div>
          <div style={{ fontSize: 11, color: colors.onSurfaceDim, marginLeft: 100 }}>
            {LEVEL_INFO[reasoningConfig[phase]].description}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
        <button onClick={applyReasoningConfig} disabled={saving} className="primary">
          {saving ? 'Applying...' : 'Apply'}
        </button>
        {saveMessage && <span style={{ fontSize: 12, color: saveMessage.startsWith('Error') ? colors.red : colors.green }}>{saveMessage}</span>}
      </div>
    </div>
  );

  const renderSandboxTab = () => (
    <>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ marginBottom: 0, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Sandbox</h2>
          <button onClick={loadSandboxStatus} style={{ fontSize: 11, padding: '4px 12px' }}>Check Docker</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: sandboxStatus?.available ? colors.green : colors.red }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 13 }}>{sandboxStatus?.available ? 'Docker Available' : 'Docker Not Available'}</div>
            <div style={{ fontSize: 11, color: colors.onSurfaceDim }}>{sandboxStatus?.dockerVersion || sandboxStatus?.error || 'Checking...'}</div>
          </div>
        </div>
      </div>
      <SandboxPlayground />
    </>
  );

  const renderEnvTab = () => (
    <div style={cardStyle}>
      <h2 style={{ marginBottom: 16, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Environment Variables</h2>
      <pre style={{ background: colors.surface, padding: 16, borderRadius: 4, overflow: 'auto', fontSize: 11, color: colors.onSurfaceDim }}>
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
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'system': return renderSystemTab();
      case 'meta-agent': return renderMetaAgentTab();
      case 'reasoning': return renderReasoningTab();
      case 'sandbox': return renderSandboxTab();
      case 'env': return renderEnvTab();
      default: return renderSystemTab();
    }
  };

  return (
    <div>
      {/* Settings Tabs with horizontal scroll */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: 0,
        marginBottom: 20,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <style>{`.settings-tabs::-webkit-scrollbar { display: none; }`}</style>
        <div className="settings-tabs" style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
                color: activeTab === tab.id ? colors.primary : colors.onSurfaceDim,
                fontFamily: colors.display,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
