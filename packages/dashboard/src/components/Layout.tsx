import { type ReactNode, useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  badge?: number;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { connected } = useWebSocket();
  const [navItems, setNavItems] = useState<NavItem[]>([
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'agents', label: 'Agents' },
    { id: 'agent-builder', label: '⚡ Agent Builder' },
    { id: 'org-chart', label: '🏢 Org Chart' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'workflows', label: '🔀 Workflows' },
    { id: 'skills', label: '⚡ Skills' },
    { id: 'consumption', label: 'Consumption' },
    { id: 'settings', label: 'Settings' },
    { id: 'knowledge-base', label: '🧠 Knowledge Base' },
    { id: 'activity-feed', label: '📡 Activity Feed' },
    { id: 'agent-inbox', label: '📬 Agent Inbox' },
  ]);

  useEffect(() => {
    const updateBadges = async () => {
      const unseen = localStorage.getItem('unseenActivityCount') || '0';
      const unread = localStorage.getItem('unreadMessagesCount') || '0';
      
      setNavItems((prev) =>
        prev.map((item) => {
          if (item.id === 'activity-feed') {
            const count = parseInt(unseen, 10);
            return { ...item, label: `📡 Activity Feed${count > 0 ? ` (${count})` : ''}` };
          }
          if (item.id === 'agent-inbox') {
            const count = parseInt(unread, 10);
            return { ...item, label: `📬 Agent Inbox${count > 0 ? ` (${count})` : ''}` };
          }
          return item;
        })
      );
    };

    updateBadges();
    const interval = setInterval(updateBadges, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: 'var(--green)',
            marginBottom: 4,
          }}>
            TrustMeBro
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Not Skynet. Probably.
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                marginBottom: 4,
                background: currentPage === item.id ? 'var(--bg-primary)' : 'transparent',
                border: '1px solid',
                borderColor: currentPage === item.id ? 'var(--green)' : 'transparent',
                color: currentPage === item.id ? 'var(--green)' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--green)' : 'var(--red)',
          }} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </aside>

      <main style={{ flex: 1, padding: 24 }}>
        {children}
      </main>
    </div>
  );
}
