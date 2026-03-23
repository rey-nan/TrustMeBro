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

export function Home() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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
      {/* Ambient Glow - Large background pulse */}
      <div className="ambient-glow" style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        height: 500,
        background: `radial-gradient(circle, ${colors.primary}08 0%, ${colors.primary}03 40%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Secondary glow rings */}
      <div className="ring-pulse" style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 350,
        height: 350,
        borderRadius: '50%',
        border: `1px solid ${colors.primary}10`,
        pointerEvents: 'none',
      }} />
      <div className="ring-pulse-delay" style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280,
        height: 280,
        borderRadius: '50%',
        border: `1px solid ${colors.primary}08`,
        pointerEvents: 'none',
      }} />

      {/* Meta-Agent Eye */}
      <div
        onClick={() => setIsSpeaking(!isSpeaking)}
        style={{
          marginTop: 30,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 10,
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
          background: `radial-gradient(circle, ${colors.primary}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Eye Sprite Container */}
        <div className="meta-eye-sprite" style={{
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
        marginTop: 8,
        zIndex: 10,
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

      {/* Small animated graph below eye */}
      <div className="activity-graph" style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 24,
        marginTop: 12,
        zIndex: 10,
        opacity: 0.4,
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="graph-bar"
            style={{
              width: 2,
              height: `${20 + Math.random() * 80}%`,
              background: colors.primary,
              borderRadius: 1,
              animation: `graphPulse ${1 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div style={{
          marginTop: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: 32,
            gap: 4,
          }}>
            {[3, 6, 4, 7, 5].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h * 4,
                  backgroundColor: colors.primary,
                  borderRadius: 4,
                  opacity: 0.9,
                  boxShadow: `0 0 10px ${colors.primary}80`,
                  animation: `waveBar ${0.8 + i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
          <p style={{
            fontFamily: fonts.display,
            fontSize: 9,
            color: `${colors.primary}50`,
            letterSpacing: '0.6em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Speaking...
          </p>
        </div>
      )}

      {/* Agent Avatars Grouped by Department */}
      {agents.length > 0 && (
        <div style={{
          marginTop: 40,
          width: '100%',
          maxWidth: 340,
          zIndex: 10,
        }}>
          {Object.entries(groupedAgents).map(([deptId, deptAgents]) => (
            <div key={deptId} style={{ marginBottom: 24 }}>
              {/* Department label */}
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

              {/* Agents in this department */}
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
                    <div
                      key={agent.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: isActive ? 1 : 0.35,
                      }}
                    >
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
          animation: eyeLife 12s steps(1) infinite, eyeGlow 4s ease-in-out infinite;
          transition: box-shadow 0.3s ease;
        }

        .meta-eye-sprite:hover {
          filter: brightness(1.2);
        }

        @keyframes eyeGlow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(0, 242, 255, 0.15), 0 0 80px rgba(0, 242, 255, 0.05);
          }
          50% {
            box-shadow: 0 0 70px rgba(0, 242, 255, 0.3), 0 0 140px rgba(0, 242, 255, 0.1);
          }
        }

        .eye-outer-glow {
          animation: outerGlowPulse 4s ease-in-out infinite;
        }

        @keyframes outerGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }

        .ambient-glow {
          animation: ambientPulse 6s ease-in-out infinite;
        }

        @keyframes ambientPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }

        .ring-pulse {
          animation: ringPulse 4s ease-in-out infinite;
        }

        .ring-pulse-delay {
          animation: ringPulse 4s ease-in-out infinite 1s;
        }

        @keyframes ringPulse {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); }
        }

        .graph-bar {
          animation: graphPulse 2s ease-in-out infinite;
        }

        @keyframes graphPulse {
          0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
          50% { opacity: 0.8; transform: scaleY(1); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes waveBar {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
