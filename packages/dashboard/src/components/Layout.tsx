import { type ReactNode } from 'react';
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
  subPages?: { id: string; label: string }[];
}

// ═══════════════════════════════════════════════════════════
// Design System: The Ethereal Command Center
// ═══════════════════════════════════════════════════════════

const styles = {
  surface: '#131313',
  surfaceMid: '#1c1b1b',
  surfaceCard: '#353534',
  primary: '#00f2ff',
  primaryText: '#e1fdff',
  onSurface: '#e5e2e1',
  onSurfaceDim: '#b9cacb',
  outline: '#3a494b',
  display: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
};

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    icon: 'home',
    label: 'HOME',
    subPages: [
      { id: 'home', label: 'Meta-Agent' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'meta-agent', label: 'Chat' },
    ],
  },
  {
    id: 'agents',
    icon: 'groups',
    label: 'AGENTS',
    subPages: [
      { id: 'agents', label: 'Agents' },
      { id: 'agent-builder', label: 'Builder' },
      { id: 'agent-inbox', label: 'Inbox' },
    ],
  },
  {
    id: 'teams',
    icon: 'corporate_fare',
    label: 'TEAMS',
    subPages: [
      { id: 'org-chart', label: 'Departments' },
    ],
  },
  {
    id: 'flows',
    icon: 'account_tree',
    label: 'FLOWS',
    subPages: [
      { id: 'workflows', label: 'Workflows' },
      { id: 'tasks', label: 'Tasks' },
    ],
  },
  {
    id: 'more',
    icon: 'more_horiz',
    label: 'MORE',
    subPages: [
      { id: 'skills', label: 'Skills' },
      { id: 'knowledge-base', label: 'Knowledge' },
      { id: 'consumption', label: 'Consumption' },
      { id: 'activity-feed', label: 'Activity' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { connected } = useWebSocket();

  // Get current section from page
  const getCurrentSection = (): string => {
    for (const item of NAV_ITEMS) {
      if (item.subPages?.some((sp) => sp.id === currentPage)) {
        return item.id;
      }
    }
    return 'home';
  };

  // Get sub-pages for current section
  const getCurrentSubPages = () => {
    const section = NAV_ITEMS.find((item) => item.id === getCurrentSection());
    return section?.subPages || [];
  };

  const currentSection = getCurrentSection();
  const subPages = getCurrentSubPages();

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
        background: `${styles.surface}ee`,
        backdropFilter: 'blur(10px)',
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
          {/* Notifications */}
          <span
            className="material-symbols-outlined"
            onClick={() => onNavigate('activity-feed')}
            style={{
              fontSize: 20,
              color: currentPage === 'activity-feed' ? styles.primary : `${styles.primary}80`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            notifications
          </span>

          {/* Settings */}
          <span
            className="material-symbols-outlined"
            onClick={() => onNavigate('settings')}
            style={{
              fontSize: 20,
              color: currentPage === 'settings' ? styles.primary : `${styles.primary}80`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            settings
          </span>

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

      {/* Sub-Page Tabs (if section has multiple pages) */}
      {subPages.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 0,
          padding: '0 24px',
          borderBottom: `1px solid ${styles.outline}20`,
        }}>
          {subPages.map((sub) => {
            const isActive = currentPage === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onNavigate(sub.id)}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${styles.primary}` : '2px solid transparent',
                  color: isActive ? styles.primary : styles.onSurfaceDim,
                  fontFamily: styles.display,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '16px 24px 120px',
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
          {NAV_ITEMS.map((item) => {
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  // Navigate to first sub-page of section
                  const firstSub = item.subPages?.[0];
                  if (firstSub) onNavigate(firstSub.id);
                }}
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
