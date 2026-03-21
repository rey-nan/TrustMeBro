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
            onClick={() => setShowConfig(!showConfig)}
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

      {showConfig && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}>
          <h3 style={{ marginBottom: 12 }}>Meta-Agent Configuration</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            To change the LLM model, edit the <code style={{ color: 'var(--green)' }}>.env</code> file and restart the API:
          </div>
          <div style={{
            background: 'var(--bg-primary)',
            padding: 12,
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}>
            <div>LLM_PROVIDER={status?.activeProvider || 'openrouter'}</div>
            <div>LLM_DEFAULT_MODEL=your-model-name</div>
            <div>LLM_API_KEY=your-api-key</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            Available providers: openrouter, groq, ollama, openai-compatible
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
