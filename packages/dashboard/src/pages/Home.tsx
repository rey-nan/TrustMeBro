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
      overflow: 'hidden',
    }}>
      {/* Ambient Glow - Large background pulse */}
      <div className="ambient-glow" style={{
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        height: 500,
        background: `radial-gradient(circle, ${colors.primary}08 0%, ${colors.primary}03 40%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Secondary glow rings */}
      <div style={{
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 350,
        height: 350,
        borderRadius: '50%',
        border: `1px solid ${colors.primary}08`,
        animation: 'ringPulse 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280,
        height: 280,
        borderRadius: '50%',
        border: `1px solid ${colors.primary}05`,
        animation: 'ringPulse 4s ease-in-out infinite 1s',
        pointerEvents: 'none',
      }} />

      {/* Meta-Agent Eye with Sprite */}
      <div
        onClick={() => setIsSpeaking(!isSpeaking)}
        style={{
          marginTop: 50,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Outer glow ring */}
        <div style={{
          position: 'absolute',
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          borderRadius: '50%',
          border: `1px solid ${colors.primary}15`,
          animation: 'outerRing 6s ease-in-out infinite',
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
          boxShadow: `0 0 60px ${colors.primary}25, 0 0 120px ${colors.primary}10`,
          animation: 'eyeLife 12s steps(1) infinite',
        }} />
      </div>

      {/* Identity */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 16,
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
        marginTop: 50,
        width: '100%',
        maxWidth: 300,
        zIndex: 10,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 28,
          justifyItems: 'center',
        }}>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: agent.status === 'active' ? 1 : 0.35,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            >
              {/* Avatar Circle */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: agent.status === 'active' ? colors.surfaceCard : `${colors.surfaceCard}60`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                border: agent.status === 'active' ? `1px solid ${agent.accentColor}40` : `1px solid ${colors.onSurfaceDim}15`,
                boxShadow: agent.status === 'active' ? `0 0 20px ${agent.accentColor}30` : 'none',
              }}>
                {agent.emoji}
              </div>

              {/* Name */}
              <span style={{
                fontFamily: fonts.display,
                fontSize: 9,
                color: agent.status === 'active' ? colors.onSurfaceDim : `${colors.onSurfaceDim}60`,
                marginTop: 8,
              }}>
                {agent.name}
              </span>

              {/* Status Dot */}
              <div style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: agent.status === 'active' ? colors.green : `${colors.onSurfaceDim}25`,
                marginTop: 4,
                animation: agent.status === 'active' ? 'pulse 2s infinite' : 'none',
                boxShadow: agent.status === 'active' ? `0 0 6px ${colors.green}60` : 'none',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        /* Eye Sprite Animation */
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
          transition: box-shadow 0.3s ease;
        }

        .meta-eye-sprite:hover {
          box-shadow: 0 0 80px rgba(0, 242, 255, 0.35), 0 0 150px rgba(0, 242, 255, 0.15) !important;
        }

        /* Ambient glow pulse */
        .ambient-glow {
          animation: ambientPulse 6s ease-in-out infinite;
        }

        @keyframes ambientPulse {
          0%, 100% { 
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        /* Ring animations */
        @keyframes ringPulse {
          0%, 100% { 
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }

        @keyframes outerRing {
          0%, 100% { 
            opacity: 0.2;
            transform: scale(1);
          }
          50% { 
            opacity: 0.6;
            transform: scale(1.02);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        @keyframes waveBar {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
