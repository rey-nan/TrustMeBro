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

interface EnvConfig {
  LLM_PROVIDER: string;
  LLM_API_KEY: string;
  LLM_DEFAULT_MODEL: string;
  LLM_BASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
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
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('openrouter');
  const [metaConfig, setMetaConfig] = useState<MetaConfig>({ soulExtras: '', model: '' });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaveMessage, setMetaSaveMessage] = useState('');
  const [configSaved, setConfigSaved] = useState(false);

  // Telegram status
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean; running: boolean }>({ configured: false, running: false });
  const [telegramLoading, setTelegramLoading] = useState(false);

  useEffect(() => {
    loadStatus();
    loadReasoningBudget();
    loadSandboxStatus();
    loadEnvConfig();
    loadMetaConfig();
    checkTelegramStatus();
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

  const loadEnvConfig = async () => {
    try {
      const res = await api.get<EnvConfig>('/api/meta/env');
      if (res.success && res.data) {
        setEnvConfig(res.data);
        setSelectedProvider(res.data.LLM_PROVIDER || 'openrouter');
      }
    } catch {}
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

  const checkTelegramStatus = async () => {
    try {
      const res = await api.get('/api/status');
      if (res.success && res.data) {
        const data = res.data as any;
        const hasToken = data.telegramConfigured || (envConfig?.TELEGRAM_BOT_TOKEN && envConfig.TELEGRAM_BOT_TOKEN.length > 0);
        setTelegramStatus({ configured: !!hasToken, running: false });
      }
    } catch {}
  };

  const startTelegram = async () => {
    setTelegramLoading(true);
    try {
      const res = await api.post('/api/telegram/start', {});
      if (res.success) {
        setTelegramStatus({ configured: true, running: true });
        setMetaSaveMessage('Telegram bot started!');
      } else {
        setMetaSaveMessage(`Error: ${res.error}`);
      }
    } catch {
      setMetaSaveMessage('Error starting Telegram bot');
    }
    setTelegramLoading(false);
    setTimeout(() => setMetaSaveMessage(''), 3000);
  };

  const saveMetaConfig = async () => {
    setMetaSaving(true);
    setMetaSaveMessage('');

    // Save env config
    const envData: Record<string, string> = { LLM_PROVIDER: selectedProvider };
    ['LLM_API_KEY', 'LLM_DEFAULT_MODEL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].forEach(key => {
      const el = document.getElementById(`env-${key}`) as HTMLInputElement;
      if (el) envData[key] = el.value;
    });
    await api.put('/api/meta/env', envData);

    // Save meta config (soul extras)
    await api.put('/api/meta/config', metaConfig);

    setMetaSaving(false);
    setConfigSaved(true);
    setMetaSaveMessage('Saved! Restart API to apply changes.');
    setTimeout(() => setMetaSaveMessage(''), 5000);
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

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: colors.surface,
    border: `1px solid ${colors.outline}40`,
    borderRadius: 6,
    color: colors.onSurface,
    fontSize: 13,
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
        <label style={labelStyle}>API Secret Key</label>
        <input type="password" value={apiSecretKey} onChange={(e) => setApiSecretKey(e.target.value)} placeholder="Set a strong secret key" style={inputStyle} />
      </div>
    </>
  );

  const renderMetaAgentTab = () => (
    <>
      {/* Config saved warning */}
      {configSaved && (
        <div style={{
          background: 'rgba(255,165,0,0.1)',
          border: '1px solid orange',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 'bold', color: 'orange', fontSize: 13 }}>Config saved but not applied</div>
            <div style={{ fontSize: 11, color: colors.onSurfaceDim }}>Restart the API to apply changes.</div>
          </div>
          <button onClick={() => setConfigSaved(false)} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid orange', borderRadius: 4, color: 'orange', fontSize: 11 }}>
            Dismiss
          </button>
        </div>
      )}

      {/* LLM Configuration */}
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 16, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>LLM Configuration</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Provider</label>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="openrouter">OpenRouter</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama</option>
              <option value="openai-compatible">OpenAI Compatible</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>API Key</label>
            <input id="env-LLM_API_KEY" type="password" defaultValue={envConfig?.LLM_API_KEY || ''} placeholder="Enter API key" style={inputStyle} />
            {envConfig?.LLM_API_KEY && <div style={{ fontSize: 10, color: colors.onSurfaceDim, marginTop: 4 }}>Current: {envConfig.LLM_API_KEY}</div>}
          </div>
          <div>
            <label style={labelStyle}>Model</label>
            <input id="env-LLM_DEFAULT_MODEL" defaultValue={envConfig?.LLM_DEFAULT_MODEL || ''} placeholder="e.g., deepseek/deepseek-chat" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ marginBottom: 0, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Telegram Integration</h2>
          <button
            onClick={startTelegram}
            disabled={telegramLoading || !envConfig?.TELEGRAM_BOT_TOKEN}
            style={{
              padding: '6px 14px',
              background: telegramStatus.running ? colors.green : colors.primary,
              color: colors.surface,
              border: 'none',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: colors.display,
              fontWeight: 'bold',
              cursor: telegramLoading ? 'not-allowed' : 'pointer',
              opacity: telegramLoading || !envConfig?.TELEGRAM_BOT_TOKEN ? 0.5 : 1,
            }}
          >
            {telegramLoading ? 'Starting...' : telegramStatus.running ? 'Running' : 'Start Bot'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Bot Token</label>
            <input id="env-TELEGRAM_BOT_TOKEN" type="password" defaultValue={envConfig?.TELEGRAM_BOT_TOKEN || ''} placeholder="Enter bot token" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Chat ID</label>
            <input id="env-TELEGRAM_CHAT_ID" defaultValue={envConfig?.TELEGRAM_CHAT_ID || ''} placeholder="Your Telegram chat ID" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* SOUL Extras */}
      <div style={cardStyle}>
        <h2 style={{ marginBottom: 8, fontSize: 14, fontFamily: colors.display, color: colors.primaryText }}>Meta-Agent SOUL</h2>
        <p style={{ fontSize: 12, color: colors.onSurfaceDim, marginBottom: 16 }}>
          Base SOUL is hardcoded. This adds extra personality traits on top.
        </p>
        <label style={labelStyle}>Soul Extras</label>
        <textarea
          value={metaConfig.soulExtras}
          onChange={(e) => setMetaConfig({ ...metaConfig, soulExtras: e.target.value })}
          placeholder="e.g., Be more formal with clients. Avoid Skynet jokes in serious contexts."
          style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
        />
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={saveMetaConfig} disabled={metaSaving} style={{
          padding: '10px 24px',
          background: colors.green,
          color: colors.surface,
          border: 'none',
          borderRadius: 6,
          fontFamily: colors.display,
          fontWeight: 'bold',
          cursor: metaSaving ? 'not-allowed' : 'pointer',
        }}>
          {metaSaving ? 'Saving...' : 'Save All Config'}
        </button>
        {metaSaveMessage && (
          <span style={{ fontSize: 12, color: metaSaveMessage.startsWith('Error') ? colors.red : colors.green }}>
            {metaSaveMessage}
          </span>
        )}
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
        <button onClick={applyReasoningConfig} disabled={saving} style={{ padding: '10px 24px', background: colors.green, color: colors.surface, border: 'none', borderRadius: 6, fontFamily: colors.display, fontWeight: 'bold' }}>
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

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

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
      {/* Settings Tabs */}
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
