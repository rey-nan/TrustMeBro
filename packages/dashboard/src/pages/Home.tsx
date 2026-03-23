import { useState, useEffect } from 'react';
import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════
// Design System Colors
// ═══════════════════════════════════════════════════════════

const colors = {
  surface: '#131313',
  surfaceCard: '#353534',
  primary: '#00f2ff',
  primaryText: '#e1fdff',
  onSurface: '#e5e2e1',
  onSurfaceDim: '#b9cacb',
  green: '#4ae176',
  purple: '#ddb7ff',
};

const fonts = {
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
};

const AGENT_EMOJIS = ['🔍', '💻', '📝', '📊', '🧪', '🎨', '🔬', '📡', '🛠️', '🤖'];
const DEPT_COLORS: Record<string, string> = {
  research: colors.green,
  development: colors.purple,
  content: colors.primary,
  default: '#ff887c',
};

// Simple markdown renderer
function renderMarkdown(text: string): string {
  return text
    // Remove system tags first
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/<apicall>[\s\S]*?<\/apicall>/gi, '')
    .replace(/<api_call>[\s\S]*?<\/api_call>/gi, '')
    .replace(/<api_result>[\s\S]*?<\/api_result>/gi, '')
    .replace(/<api_error>[\s\S]*?<\/api_error>/gi, '')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background:#131313;padding:8px;border-radius:4px;margin:8px 0;overflow-x:auto;font-size:12px"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#131313;padding:2px 4px;border-radius:3px;font-size:12px">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<div style="font-weight:bold;font-size:14px;margin:8px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:bold;font-size:15px;margin:10px 0 4px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-weight:bold;font-size:16px;margin:12px 0 4px">$1</div>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<div style="padding-left:12px">• $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:12px">$&</div>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

interface Agent {
  id: string;
  name: string;
  status?: string;
  department?: string;
}

interface Department {
  id: string;
  name: string;
  color?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('meta-chat-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    return localStorage.getItem('meta-chat-conversation') || undefined;
  });

  useEffect(() => {
    loadData();
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem('meta-chat-messages', JSON.stringify(messages));
  }, [messages]);

  // Persist conversationId
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('meta-chat-conversation', conversationId);
    }
  }, [conversationId]);

  const loadData = async () => {
    try {
      const [agentsRes, deptsRes] = await Promise.all([
        api.get('/api/agents'),
        api.get('/api/departments'),
      ]);
      if (agentsRes.success && agentsRes.data) setAgents(agentsRes.data as Agent[]);
      if (deptsRes.success && deptsRes.data) setDepartments(deptsRes.data as Department[]);
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await api.post('/api/meta/chat', { message: input, conversationId });
      if (res.success && res.data) {
        const data = res.data as { message: string; conversationId: string };
        if (data.conversationId) setConversationId(data.conversationId);
        const assistantMsg: Message = { role: 'assistant', content: data.message };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const errorMsg: Message = { role: 'assistant', content: 'Erro ao processar mensagem.' };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsThinking(false);
  };

  // Group agents by department
  const groupedAgents: Record<string, Agent[]> = {};
  agents.forEach((agent) => {
    const dept = agent.department || 'ungrouped';
    if (!groupedAgents[dept]) groupedAgents[dept] = [];
    groupedAgents[dept].push(agent);
  });

  const getDeptColor = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    return dept?.color || DEPT_COLORS[deptId] || DEPT_COLORS.default;
  };

  const getDeptName = (deptId: string) => {
    if (deptId === 'ungrouped') return 'Agents';
    const dept = departments.find((d) => d.id === deptId);
    return dept?.name || deptId;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: 'calc(100vh - 180px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient Glow */}
      <div className="ambient-glow" style={{
        position: 'absolute',
        top: isOpen ? '10%' : '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        height: 500,
        background: `radial-gradient(circle, ${colors.primary}08 0%, ${colors.primary}03 40%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
        transition: 'top 0.5s ease',
      }} />

      {/* Ring pulses */}
      <div className="ring-pulse" style={{
        position: 'absolute',
        top: isOpen ? '10%' : '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 350,
        height: 350,
        borderRadius: '50%',
        border: `1px solid ${colors.primary}10`,
        pointerEvents: 'none',
        transition: 'top 0.5s ease',
      }} />

      {/* ═══════════════════════════════════════════════════════
          META EYE
          ═══════════════════════════════════════════════════════ */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          marginTop: isOpen ? 0 : 50,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 10,
          transition: 'all 0.5s ease',
          transform: isOpen ? 'scale(0.6)' : 'scale(1)',
        }}
      >
        {/* Outer pulsing glow */}
        <div className="eye-outer-glow" style={{
          position: 'absolute',
          top: -30,
          left: -30,
          right: -30,
          bottom: -30,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.primary}${isThinking ? '25' : '12'} 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
        }} />

        {/* Eye Sprite */}
        <div className={`meta-eye-sprite ${isThinking ? 'thinking' : ''}`} style={{
          width: 180,
          height: 180,
          backgroundImage: 'url(/eye-sprite.webp)',
          backgroundSize: '400% 100%',
          backgroundRepeat: 'no-repeat',
          borderRadius: '50%',
          WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 70%)',
          maskImage: 'radial-gradient(circle, black 40%, transparent 70%)',
        }} />
      </div>

      {/* Identity */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: isOpen ? 0 : 8,
        zIndex: 10,
        transform: isOpen ? 'scale(0.8)' : 'scale(1)',
        transition: 'all 0.5s ease',
        opacity: isOpen ? 0.7 : 1,
      }}>
        <h2 style={{
          fontFamily: fonts.display,
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: '0.6em',
          textTransform: 'uppercase',
          color: `${colors.primaryText}cc`,
          margin: 0,
        }}>
          META
        </h2>
      </div>

      {/* ═══════════════════════════════════════════════════════
          THINKING INDICATOR (only when processing)
          ═══════════════════════════════════════════════════════ */}
      {isThinking && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          zIndex: 10,
        }}>
          {/* Activity graph */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: 20,
          }}>
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="graph-bar"
                style={{
                  width: 2,
                  height: `${30 + Math.random() * 70}%`,
                  background: colors.primary,
                  borderRadius: 1,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>

          <p style={{
            fontFamily: fonts.display,
            fontSize: 9,
            color: `${colors.primary}60`,
            letterSpacing: '0.6em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Thinking...
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          AGENTS GRID (hidden when chat is open)
          ═══════════════════════════════════════════════════════ */}
      {!isOpen && agents.length > 0 && (
        <div style={{
          marginTop: 40,
          width: '100%',
          maxWidth: 340,
          zIndex: 10,
          animation: 'fadeIn 0.3s ease',
        }}>
          {Object.entries(groupedAgents).map(([deptId, deptAgents]) => (
            <div key={deptId} style={{ marginBottom: 24 }}>
              <p style={{
                fontFamily: fonts.display,
                fontSize: 9,
                color: getDeptColor(deptId),
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: 12,
                textAlign: 'center',
                opacity: 0.7,
              }}>
                {getDeptName(deptId)}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(deptAgents.length, 4)}, 1fr)`,
                gap: 20,
                justifyItems: 'center',
              }}>
                {deptAgents.map((agent, index) => {
                  const isActive = agent.status !== 'idle';
                  const emoji = AGENT_EMOJIS[index % AGENT_EMOJIS.length];
                  const accentColor = getDeptColor(deptId);

                  return (
                    <div key={agent.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      opacity: isActive ? 1 : 0.35,
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: isActive ? colors.surfaceCard : `${colors.surfaceCard}60`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        border: isActive ? `1px solid ${accentColor}40` : `1px solid ${colors.onSurfaceDim}15`,
                        boxShadow: isActive ? `0 0 15px ${accentColor}25` : 'none',
                      }}>
                        {emoji}
                      </div>
                      <span style={{
                        fontFamily: fonts.display,
                        fontSize: 8,
                        color: isActive ? colors.onSurfaceDim : `${colors.onSurfaceDim}50`,
                        marginTop: 6,
                        maxWidth: 60,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {agent.name}
                      </span>
                      <div style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: isActive ? colors.green : `${colors.onSurfaceDim}20`,
                        marginTop: 3,
                        animation: isActive ? 'pulse 2s infinite' : 'none',
                        boxShadow: isActive ? `0 0 4px ${colors.green}50` : 'none',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CHAT (visible when eye is clicked)
          ═══════════════════════════════════════════════════════ */}
      {isOpen && (
        <div style={{
          width: '100%',
          maxWidth: 500,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          animation: 'slideUp 0.4s ease',
        }}>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 0',
            minHeight: 200,
            maxHeight: 'calc(100vh - 400px)',
          }}>
            {messages.length === 0 && (
              <p style={{
                textAlign: 'center',
                color: colors.onSurfaceDim,
                fontFamily: fonts.display,
                fontSize: 11,
                opacity: 0.5,
                marginTop: 40,
              }}>
                Ask Meta anything...
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  background: msg.role === 'user' ? `${colors.primary}20` : colors.surfaceCard,
                  color: colors.onSurface,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
                dangerouslySetInnerHTML={{ __html: msg.role === 'user' ? msg.content : renderMarkdown(msg.content) }}
                />
              </div>
            ))}

            {isThinking && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
              }}>
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
                <span style={{
                  fontSize: 11,
                  color: colors.onSurfaceDim,
                  fontFamily: fonts.display,
                }}>
                  Meta is thinking...
                </span>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '12px 0',
            borderTop: `1px solid ${colors.primary}15`,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                background: colors.surfaceCard,
                border: `1px solid ${colors.primary}20`,
                borderRadius: 8,
                padding: '10px 14px',
                color: colors.onSurface,
                fontSize: 13,
                fontFamily: fonts.body,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              style={{
                background: colors.primary,
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                color: colors.surface,
                cursor: 'pointer',
                fontFamily: fonts.display,
                fontSize: 12,
                fontWeight: 'bold',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes eyeLife {
          0%, 80% { background-position: 0% 0%; }
          82% { background-position: 33.333% 0%; }
          84% { background-position: 0% 0%; }
          88% { background-position: 66.666% 0%; }
          91% { background-position: 0% 0%; }
          94% { background-position: 100% 0%; }
          97% { background-position: 0% 0%; }
          98% { background-position: 33.333% 0%; }
          100% { background-position: 0% 0%; }
        }

        .meta-eye-sprite {
          animation: eyeLife 12s steps(1) infinite, eyeGlow 5s ease-in-out infinite;
          transition: all 0.3s ease;
        }

        .meta-eye-sprite.thinking {
          animation: eyeLife 12s steps(1) infinite, eyeGlowIntense 1.5s ease-in-out infinite;
        }

        .meta-eye-sprite:hover {
          filter: brightness(1.15);
        }

        @keyframes eyeGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 242, 255, 0.08), 0 0 40px rgba(0, 242, 255, 0.03);
          }
          50% {
            box-shadow: 0 0 80px rgba(0, 242, 255, 0.35), 0 0 160px rgba(0, 242, 255, 0.15);
          }
        }

        @keyframes eyeGlowIntense {
          0%, 100% { box-shadow: 0 0 60px rgba(0, 242, 255, 0.4), 0 0 120px rgba(0, 242, 255, 0.2); }
          50% { box-shadow: 0 0 120px rgba(0, 242, 255, 0.7), 0 0 200px rgba(0, 242, 255, 0.3); }
        }

        .eye-outer-glow {
          animation: outerGlowPulse 5s ease-in-out infinite;
        }

        @keyframes outerGlowPulse {
          0%, 100% { opacity: 0.15; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        .ambient-glow {
          animation: ambientPulse 6s ease-in-out infinite;
        }

        @keyframes ambientPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .ring-pulse {
          animation: ringPulse 4s ease-in-out infinite;
        }

        @keyframes ringPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }

        .graph-bar {
          animation: graphPulse 1.5s ease-in-out infinite;
        }

        @keyframes graphPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.5); }
          50% { opacity: 0.9; transform: scaleY(1); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${colors.primary};
          animation: typingBounce 1.4s infinite;
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
