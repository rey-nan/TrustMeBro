import { type ReactNode, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

// ═══════════════════════════════════════════════════════════
// Design System: The Ethereal Command Center
// ═══════════════════════════════════════════════════════════

const styles = {
  // Colors
  surface: '#131313',
  surfaceLow: '#0e0e0e',
  surfaceMid: '#1c1b1b',
  surfaceHigh: '#2a2a2a',
  surfaceCard: '#353534',
  primary: '#00f2ff',
  primaryDim: '#00dbe7',
  primaryText: '#e1fdff',
  onSurface: '#e5e2e1',
  onSurfaceDim: '#b9cacb',
  outline: '#3a494b',

  // Fonts
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
};

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { connected } = useWebSocket();
  const [navItems] = useState<NavItem[]>([
    { id: 'home', icon: 'home', label: 'HOME' },
    { id: 'agents', icon: 'groups', label: 'AGENTS' },
    { id: 'teams', icon: 'corporate_fare', label: 'TEAMS' },
    { id: 'flows', icon: 'account_tree', label: 'FLOWS' },
    { id: 'more', icon: 'more_horiz', label: 'MORE' },
  ]);

  // Map old pages to new sections
  const getCurrentSection = (): string => {
    const sectionMap: Record<string, string> = {
      'home': 'home',
      'dashboard': 'home',
      'meta-agent': 'home',
      'agents': 'agents',
      'agent-builder': 'agents',
      'agent-inbox': 'agents',
      'org-chart': 'teams',
      'workflows': 'flows',
      'tasks': 'flows',
      'skills': 'more',
      'knowledge-base': 'more',
      'consumption': 'more',
      'activity-feed': 'more',
      'settings': 'more',
    };
    return sectionMap[currentPage] || 'home';
  };

  const handleNavClick = (sectionId: string) => {
    // Map sections to default pages
    const defaultPages: Record<string, string> = {
      'home': 'home',
      'agents': 'agents',
      'teams': 'org-chart',
      'flows': 'workflows',
      'more': 'settings',
    };
    onNavigate(defaultPages[sectionId] || sectionId);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: styles.surface,
      color: styles.onSurface,
      fontFamily: styles.body,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: styles.display,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontSize: 14,
            fontWeight: 'bold',
            color: styles.primaryText,
          }}>
            TRUSTMEBRO
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontFamily: styles.display,
            letterSpacing: '0.1em',
            color: connected ? styles.primary : styles.onSurfaceDim,
            opacity: 0.6,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: connected ? '#4ae176' : '#ff4444',
              boxShadow: connected ? '0 0 8px rgba(74, 225, 118, 0.5)' : 'none',
            }} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '0 24px 120px',
        overflowY: 'auto',
        position: 'relative',
      }}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: `${styles.surfaceMid}cc`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `0.5px solid ${styles.primary}10`,
        padding: '12px 16px 28px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          maxWidth: 500,
          margin: '0 auto',
        }}>
          {navItems.map((item) => {
            const isActive = getCurrentSection() === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isActive ? styles.primary : `${styles.onSurface}50`,
                  transition: 'all 0.3s ease',
                  filter: isActive ? `drop-shadow(0 0 10px ${styles.primary}60)` : 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: 22,
                  fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400",
                }}>
                  {item.icon}
                </span>
                <span style={{
                  fontFamily: styles.display,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
