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

  const getCurrentSection = (): string => {
    for (const item of NAV_ITEMS) {
      if (item.subPages?.some((sp) => sp.id === currentPage)) {
        return item.id;
      }
    }
    return 'home';
  };

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
      height: '100vh',
      background: styles.surface,
      color: styles.onSurface,
      fontFamily: styles.body,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        flexShrink: 0,
        background: `${styles.surface}ee`,
        backdropFilter: 'blur(10px)',
        zIndex: 100,
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

      {/* Sub-Page Tabs with horizontal scroll */}
      {subPages.length > 1 && (
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
          padding: '0 24px',
          borderBottom: `1px solid ${styles.outline}20`,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <style>{`.sub-tabs::-webkit-scrollbar { display: none; }`}</style>
          <div className="sub-tabs" style={{
            display: 'flex',
            gap: 0,
            whiteSpace: 'nowrap',
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
                    flexShrink: 0,
                  }}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content - scrollable */}
      <main style={{
        flex: 1,
        padding: '16px 24px',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </main>

      {/* Bottom Navigation - always visible */}
      <nav style={{
        flexShrink: 0,
        background: `${styles.surfaceMid}ee`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `0.5px solid ${styles.primary}10`,
        padding: '12px 16px 28px',
        zIndex: 100,
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
