import { useState, Component, ReactNode, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { AgentBuilder } from './pages/AgentBuilder';
import { OrgChart } from './pages/OrgChart';
import { Tasks } from './pages/Tasks';
import { Consumption } from './pages/Consumption';
import { Settings } from './pages/Settings';
import { ActivityFeed } from './pages/ActivityFeed';
import { AgentInbox } from './pages/AgentInbox';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Skills } from './pages/Skills';
import { Workflows } from './pages/Workflows';
import { wsClient } from './api/client';

type Page = 'dashboard' | 'agents' | 'agent-builder' | 'org-chart' | 'tasks' | 'workflows' | 'skills' | 'consumption' | 'settings' | 'activity-feed' | 'agent-inbox' | 'knowledge-base';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          color: '#ff4444',
          fontFamily: 'monospace',
          maxWidth: 600,
          margin: '2rem auto',
        }}>
          <h2 style={{ color: '#ff4444', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{ 
            fontSize: '0.8rem', 
            color: '#888',
            background: '#1a1a1a',
            padding: '1rem',
            borderRadius: 4,
            overflow: 'auto',
            marginBottom: '1rem',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false })} 
            style={{
              padding: '0.5rem 1rem',
              background: '#00ff88',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'agents':
        return <Agents />;
      case 'agent-builder':
        return <AgentBuilder />;
      case 'org-chart':
        return <OrgChart />;
      case 'tasks':
        return <Tasks />;
      case 'workflows':
        return <Workflows />;
      case 'skills':
        return <Skills />;
      case 'consumption':
        return <Consumption />;
      case 'settings':
        return <Settings />;
      case 'activity-feed':
        return <ActivityFeed />;
      case 'agent-inbox':
        return <AgentInbox />;
      case 'knowledge-base':
        return <KnowledgeBase />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)}>
        {renderPage()}
      </Layout>
    </ErrorBoundary>
  );
}
