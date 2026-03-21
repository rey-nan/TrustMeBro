import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: { type: string; message?: string; method?: string; endpoint?: string }[];
}

interface SystemStatus {
  activeProvider: string;
  agentsRegistered: number;
}

interface EnvConfig {
  LLM_PROVIDER: string;
  LLM_API_KEY: string;
  LLM_DEFAULT_MODEL: string;
  LLM_BASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

const SUGGESTIONS = [
  'What is the dashboard URL?',
  'List all my agents',
  'Show system status',
  'Is Telegram configured?',
  'Create a new agent',
];

export function MetaAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const res = await api.get<SystemStatus>('/api/status');
    if (res.success && res.data) {
      setStatus(res.data);
    }
  };

  const loadEnvConfig = async () => {
    const res = await api.get<EnvConfig>('/api/meta/env');
    if (res.success && res.data) {
      setEnvConfig(res.data);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.post<{
        conversationId: string;
        message: string;
        actions: { type: string; message?: string }[];
      }>('/api/meta/chat', {
        message: userMessage,
        conversationId,
      });

      if (res.success && res.data) {
        setConversationId(res.data.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data!.message,
            actions: res.data!.actions,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${res.error || 'Failed to process request'}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Failed to connect to API. Make sure the server is running.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ color: 'var(--green)', marginBottom: 4 }}>🧠 Meta-Agent</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Tell me what you need in plain language.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <div style={{
              padding: '4px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}>
              Model: <span style={{ color: 'var(--green)' }}>{status.activeProvider}</span>
              {' • '}
              Agents: <span style={{ color: 'var(--cyan)' }}>{status.agentsRegistered}</span>
            </div>
          )}
          <button
            onClick={() => {
              setShowConfig(!showConfig);
              if (!showConfig) loadEnvConfig();
            }}
            style={{
              padding: '6px 12px',
              background: showConfig ? 'var(--green)' : 'transparent',
              color: showConfig ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ⚙️ Config
          </button>
        </div>
      </div>

      {configSaved && (
        <div style={{
          background: 'rgba(255,165,0,0.1)',
          border: '1px solid orange',
          borderRadius: 4,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 'bold', color: 'orange' }}>⚠ Config saved but not applied yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              The API is still using the old configuration. Restart the API to apply changes.
            </div>
          </div>
          <button
            onClick={() => setConfigSaved(false)}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid orange',
              borderRadius: 4,
              color: 'orange',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {showConfig && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
          maxHeight: '60vh',
          overflow: 'auto',
        }}>
          <h3 style={{ marginBottom: 16 }}>🧠 Meta-Agent Configuration</h3>

          {/* LLM Config */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 8, color: 'var(--cyan)' }}>LLM Configuration</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Provider</label>
                <select
                  id="env-LLM_PROVIDER"
                  defaultValue={envConfig?.LLM_PROVIDER || 'openrouter'}
                  style={{ width: '100%' }}
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="groq">Groq</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai-compatible">OpenAI Compatible</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>API Key</label>
                <input
                  id="env-LLM_API_KEY"
                  type="password"
                  defaultValue={envConfig?.LLM_API_KEY || ''}
                  placeholder="Enter new API key to change"
                  style={{ width: '100%' }}
                />
                {envConfig?.LLM_API_KEY && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Current: {envConfig.LLM_API_KEY}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Model</label>
                <input
                  id="env-LLM_DEFAULT_MODEL"
                  defaultValue={envConfig?.LLM_DEFAULT_MODEL || ''}
                  placeholder="e.g., deepseek/deepseek-chat"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Telegram Config */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 8, color: 'var(--cyan)' }}>Telegram (Optional)</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Bot Token</label>
                <input
                  id="env-TELEGRAM_BOT_TOKEN"
                  type="password"
                  defaultValue={envConfig?.TELEGRAM_BOT_TOKEN || ''}
                  placeholder="Enter bot token"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Chat ID</label>
                <input
                  id="env-TELEGRAM_CHAT_ID"
                  defaultValue={envConfig?.TELEGRAM_CHAT_ID || ''}
                  placeholder="Your Telegram chat ID"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8, color: 'var(--cyan)' }}>System Prompt (SOUL)</h4>
            <textarea
              id="meta-system-prompt"
              defaultValue={`You are TrustMeBro's Meta-Agent. You help users manage their AI agent system.

IMPORTANT:
- Dashboard URL: http://localhost:5173
- API URL: http://localhost:3000
- To configure Telegram: run "node setup.js --telegram"
- For external access: use ngrok (ngrok http 5173)

Always provide correct URLs and commands when asked about the system.`}
              style={{
                width: '100%',
                height: 150,
                padding: 12,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                // Save .env
                const envData: Record<string, string> = {};
                ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_DEFAULT_MODEL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].forEach(key => {
                  const el = document.getElementById(`env-${key}`) as HTMLInputElement;
                  if (el) envData[key] = el.value;
                });
                await api.put('/api/meta/env', envData);

                // Save system prompt
                const textarea = document.getElementById('meta-system-prompt') as HTMLTextAreaElement;
                if (textarea) {
                  await api.put('/api/meta/config', { systemPrompt: textarea.value });
                }

                setConfigSaved(true);
                setShowConfig(false);
              }}
              style={{
                padding: '8px 16px',
                background: 'var(--green)',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Save Config
            </button>
            <button
              onClick={() => setShowConfig(false)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🧠</div>
            <div style={{ marginBottom: 24 }}>What would you like me to help you with?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              padding: 12,
              background: msg.role === 'user' ? 'var(--bg-primary)' : 'rgba(0,255,136,0.05)',
              borderRadius: 8,
              border: msg.role === 'user' ? '1px solid var(--border-color)' : '1px solid rgba(0,255,136,0.2)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: msg.role === 'user' ? 'var(--text-secondary)' : 'var(--green)',
                marginBottom: 8,
                fontWeight: 'bold',
              }}
            >
              {msg.role === 'user' ? 'You' : 'Meta-Agent'}
            </div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{msg.content}</div>

            {msg.actions && msg.actions.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  background: 'var(--bg-secondary)',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Actions taken:</div>
                {msg.actions.map((action, j) => (
                  <div
                    key={j}
                    style={{
                      color: action.type === 'error' ? 'var(--red)' : 'var(--green)',
                      marginLeft: 8,
                    }}
                  >
                    {action.type === 'error' ? '✗' : '✓'} {action.message || `${action.method} ${action.endpoint}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)' }}>
            <span style={{ animation: 'pulse 1s infinite' }}>⏳ Meta-Agent is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your request... (Enter to send, Shift+Enter for new line)"
          disabled={loading}
          style={{
            flex: 1,
            padding: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            resize: 'none',
            height: 60,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              flex: 1,
              padding: '0 24px',
              background: 'var(--green)',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              padding: '0 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
