import { useState } from 'react';

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

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: 'active' | 'idle';
  accentColor: string;
}

const mockAgents: Agent[] = [
  { id: '1', name: 'Pesquisador', emoji: '🔍', status: 'active', accentColor: colors.green },
  { id: '2', name: 'Coder', emoji: '💻', status: 'active', accentColor: colors.purple },
  { id: '3', name: 'Writer', emoji: '📝', status: 'idle', accentColor: colors.primary },
  { id: '4', name: 'Analyst', emoji: '📊', status: 'idle', accentColor: colors.onSurfaceDim },
  { id: '5', name: 'Tester', emoji: '🧪', status: 'idle', accentColor: colors.onSurfaceDim },
];

export function Home() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const agents = mockAgents;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: 'calc(100vh - 180px)',
      position: 'relative',
    }}>
      {/* Ambient Glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        height: 400,
        background: `${colors.primary}05`,
        borderRadius: '50%',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      {/* Meta-Agent Eye with Sprite */}
      <div
        onClick={() => setIsSpeaking(!isSpeaking)}
        style={{
          marginTop: 40,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
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
          boxShadow: `0 0 80px ${colors.primary}20`,
          animation: 'eyeLife 12s steps(1) infinite',
        }} />
      </div>

      {/* Identity */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 16,
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
          META-AGENT
        </h2>

        {/* Speaking Indicator */}
        {isSpeaking && (
          <div style={{
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
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
      </div>

      {/* Agent Avatars Grid */}
      <div style={{
        marginTop: 40,
        width: '100%',
        maxWidth: 340,
      }}>
        <p style={{
          fontFamily: fonts.display,
          fontSize: 10,
          color: colors.onSurfaceDim,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          marginBottom: 20,
          textAlign: 'center',
        }}>
          Your Agents
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          justifyItems: 'center',
        }}>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: agent.status === 'active' ? 1 : 0.4,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            >
              {/* Avatar Circle */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: agent.status === 'active' ? colors.surfaceCard : `${colors.surfaceCard}80`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                border: agent.status === 'active' ? `1px solid ${agent.accentColor}60` : 'none',
                boxShadow: agent.status === 'active' ? `0 0 15px ${agent.accentColor}40` : 'none',
                animation: agent.status === 'active' ? `avatarPulse 3s ease-in-out infinite` : 'none',
              }}>
                {agent.emoji}
              </div>

              {/* Name */}
              <span style={{
                fontFamily: fonts.display,
                fontSize: 9,
                color: agent.status === 'active' ? colors.onSurfaceDim : `${colors.onSurfaceDim}80`,
                marginTop: 8,
              }}>
                {agent.name}
              </span>

              {/* Status Dot */}
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: agent.status === 'active' ? colors.green : `${colors.onSurfaceDim}30`,
                marginTop: 4,
                animation: agent.status === 'active' ? 'pulse 2s infinite' : 'none',
              }} />
            </div>
          ))}

          {/* Add Agent Button */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            opacity: 0.3,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `1px dashed ${colors.onSurfaceDim}50`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 20,
                color: colors.onSurfaceDim,
              }}>
                add
              </span>
            </div>
            <span style={{
              fontFamily: fonts.display,
              fontSize: 9,
              color: `${colors.onSurfaceDim}50`,
              marginTop: 8,
            }}>
              Add
            </span>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        /* Eye Sprite Animation */
        @keyframes eyeLife {
          /* Frame 1: 0% (Open) - 80% of time */
          0%, 80% { background-position: 0% 0%; }
          /* Frame 2: 33.33% (Blink) */
          82% { background-position: 33.333% 0%; }
          84% { background-position: 0% 0%; }
          /* Frame 3: 66.66% (Look Left) */
          88% { background-position: 66.666% 0%; }
          91% { background-position: 0% 0%; }
          /* Frame 4: 100% (Look Right) */
          94% { background-position: 100% 0%; }
          97% { background-position: 0% 0%; }
          /* Sudden Blink at end */
          98% { background-position: 33.333% 0%; }
          100% { background-position: 0% 0%; }
        }

        .meta-eye-sprite {
          transition: box-shadow 0.3s ease;
        }

        .meta-eye-sprite:hover {
          box-shadow: 0 0 120px rgba(0, 242, 255, 0.3) !important;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes waveBar {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }

        @keyframes avatarPulse {
          0%, 100% {
            box-shadow: 0 0 10px rgba(74, 225, 118, 0.2);
          }
          50% {
            box-shadow: 0 0 25px rgba(74, 225, 118, 0.5);
          }
        }
      `}</style>
    </div>
  );
}
