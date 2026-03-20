import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface WorkflowStep {
  id: string;
  agentId: string;
  input: string;
  dependsOn?: string[];
  condition?: string;
  timeoutMs?: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  pattern: 'pipeline' | 'fan-out' | 'swarm' | 'review';
  steps: WorkflowStep[];
  combinePrompt?: string;
  reviewAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  input: string;
  finalOutput?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  totalTokens: number;
  stepResults?: Record<string, {
    agentId: string;
    status: string;
    output: string;
    durationMs: number;
    tokens: number;
  }>;
}

const PATTERN_COLORS: Record<string, string> = {
  pipeline: '#4488ff',
  'fan-out': '#aa44ff',
  swarm: '#ffaa00',
  review: '#ff8844',
};

export function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [recentRuns, setRecentRuns] = useState<Map<string, WorkflowRun>>(new Map());
  const [showBuilder, setShowBuilder] = useState(false);
  const [showRunModal, setShowRunModal] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<Workflow | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [runInput, setRunInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    fetchWorkflows();
    fetchRecentRuns();
  }, []);

  // Listen for workflow completion via WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'workflow:completed') {
      const payload = lastMessage.payload as { workflowId: string; status: string; finalOutput?: string; error?: string; totalTokens: number };
      setRunningWorkflow(null);
      setRecentRuns(prev => {
        const next = new Map(prev);
        next.set(payload.workflowId, {
          id: '',
          workflowId: payload.workflowId,
          status: payload.status as WorkflowRun['status'],
          input: '',
          finalOutput: payload.finalOutput,
          error: payload.error,
          startedAt: Date.now(),
          completedAt: Date.now(),
          totalTokens: payload.totalTokens,
        });
        return next;
      });
      // Refresh from API
      fetchRecentRuns();
    }
  }, [lastMessage]);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workflows`);
      const data = await res.json();
      if (data.success) {
        setWorkflows(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRuns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workflows/runs/recent?limit=100`);
      const data = await res.json();
      if (data.success) {
        const runsMap = new Map<string, WorkflowRun>();
        data.data.forEach((run: WorkflowRun) => {
          const existing = runsMap.get(run.workflowId);
          if (!existing || run.startedAt > existing.startedAt) {
            runsMap.set(run.workflowId, run);
          }
        });
        setRecentRuns(runsMap);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    }
  };

  const handleRun = async (workflowId: string) => {
    if (!runInput.trim()) return;
    
    try {
      setRunningWorkflow(workflowId);
      setShowRunModal(null);
      setRunInput('');
      
      const res = await fetch(`${API_URL}/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: runInput }),
      });
      const data = await res.json();
      if (!data.success) {
        setRunningWorkflow(null);
        console.error('Failed to run workflow:', data.error);
      }
      // Don't clear running state here - wait for WebSocket
    } catch (err) {
      setRunningWorkflow(null);
      console.error('Failed to run workflow:', err);
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Delete this workflow? This cannot be undone.')) return;
    
    try {
      await fetch(`${API_URL}/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });
      fetchWorkflows();
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'var(--green)';
      case 'failed': return 'var(--red)';
      case 'running': return '#4488ff';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--green)' }}>Workflows 🔀</h1>
        <button
          onClick={() => setShowBuilder(true)}
          style={{
            padding: '10px 20px',
            background: 'var(--green)',
            color: '#000',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + New Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔀</div>
          <div>No workflows yet</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Create your first workflow to orchestrate multiple agents</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {workflows.map((wf) => (
            <div
              key={wf.id}
              style={{
                padding: 20,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 'bold' }}>{wf.name}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: PATTERN_COLORS[wf.pattern] || '#666',
                        color: '#000',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      {wf.pattern}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {wf.description || 'No description'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''} • Created {formatDate(wf.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {runningWorkflow === wf.id ? (
                    <button
                      disabled
                      style={{
                        padding: '8px 16px',
                        background: '#4488ff',
                        color: '#000',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'not-allowed',
                        fontWeight: 'bold',
                      }}
                    >
                      Running...
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowRunModal(wf.id)}
                        style={{
                          padding: '8px 16px',
                          background: 'var(--green)',
                          color: '#000',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleDelete(wf.id)}
                        style={{
                          padding: '8px 16px',
                          background: 'transparent',
                          color: 'var(--red)',
                          border: '1px solid var(--red)',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowEditModal(wf)}
                        style={{
                          padding: '8px 16px',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              {recentRuns.has(wf.id) && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Last run: {formatDate(recentRuns.get(wf.id)!.startedAt)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getStatusColor(recentRuns.get(wf.id)!.status),
                      }}
                    />
                    <span style={{ fontWeight: 'bold', color: getStatusColor(recentRuns.get(wf.id)!.status) }}>
                      {recentRuns.get(wf.id)!.status}
                    </span>
                    {recentRuns.get(wf.id)!.totalTokens > 0 && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        • {recentRuns.get(wf.id)!.totalTokens} tokens
                      </span>
                    )}
                  </div>
                  {(recentRuns.get(wf.id)!.finalOutput || recentRuns.get(wf.id)!.error) && (
                    <div
                      onClick={() => setSelectedRun(recentRuns.get(wf.id)!)}
                      style={{
                        marginTop: 8,
                        padding: 8,
                        background: 'var(--bg-secondary)',
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 150,
                        overflow: 'auto',
                        color: recentRuns.get(wf.id)!.error ? 'var(--red)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--green)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    >
                      {recentRuns.get(wf.id)!.error || recentRuns.get(wf.id)!.finalOutput?.substring(0, 200)}
                      {recentRuns.get(wf.id)!.finalOutput && recentRuns.get(wf.id)!.finalOutput!.length > 200 && '... [clique para ver completo]'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showRunModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRunModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: 24,
              borderRadius: 8,
              width: 500,
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 16 }}>Run Workflow</h2>
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="Enter input for the workflow..."
              style={{
                width: '100%',
                height: 120,
                padding: 12,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                resize: 'vertical',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRunModal(null)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRun(showRunModal)}
                disabled={!runInput.trim()}
                style={{
                  padding: '10px 20px',
                  background: 'var(--green)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: runInput.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  opacity: runInput.trim() ? 1 : 0.5,
                }}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuilder && (
        <WorkflowBuilder
          onClose={() => setShowBuilder(false)}
          onSave={() => {
            setShowBuilder(false);
            fetchWorkflows();
          }}
        />
      )}

      {showEditModal && (
        <EditWorkflowModal
          workflow={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSave={() => {
            setShowEditModal(null);
            fetchWorkflows();
          }}
        />
      )}

      {selectedRun && (
        <RunDetailsModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}

interface WorkflowBuilderProps {
  onClose: () => void;
  onSave: () => void;
}

function WorkflowBuilder({ onClose, onSave }: WorkflowBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pattern, setPattern] = useState<'pipeline' | 'fan-out' | 'swarm' | 'review'>('pipeline');
  const [combinePrompt, setCombinePrompt] = useState('');
  const [reviewAgentId, setReviewAgentId] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      const data = await res.json();
      if (data.success) {
        setAgents(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: `step-${steps.length + 1}`,
        agentId: agents[0]?.id || '',
        input: '',
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map((step, i) => (i === index ? { ...step, ...updates } : step)));
  };

  const handleSave = async (runAfterSave = false) => {
    if (!name.trim() || steps.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          pattern,
          steps,
          combinePrompt: pattern === 'fan-out' ? combinePrompt : undefined,
          reviewAgentId: pattern === 'review' ? reviewAgentId : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (runAfterSave) {
          setShowRunModal(data.data.id);
        } else {
          onSave();
        }
      }
    } catch (err) {
      console.error('Failed to save workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  const [showRunModal, setShowRunModal] = useState<string | null>(null);
  const [runInput, setRunInput] = useState('');

  const handleRun = async (workflowId: string) => {
    if (!runInput.trim()) return;
    
    try {
      await fetch(`${API_URL}/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: runInput }),
      });
      setShowRunModal(null);
      setRunInput('');
      onSave();
    } catch (err) {
      console.error('Failed to run workflow:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        overflow: 'auto',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: 24,
          borderRadius: 8,
          width: 700,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 24 }}>New Workflow</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              height: 60,
              padding: 10,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Pattern</label>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as typeof pattern)}
            style={{
              width: '100%',
              padding: 10,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-primary)',
            }}
          >
            <option value="pipeline">Pipeline (sequential)</option>
            <option value="fan-out">Fan-Out (parallel + combine)</option>
            <option value="swarm">Swarm (parallel + best result)</option>
            <option value="review">Review (execute + review)</option>
          </select>
        </div>

        {pattern === 'fan-out' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Combine Prompt</label>
            <textarea
              value={combinePrompt}
              onChange={(e) => setCombinePrompt(e.target.value)}
              placeholder="Prompt for combining results..."
              style={{
                width: '100%',
                height: 60,
                padding: 10,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {pattern === 'review' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Review Agent</label>
            <select
              value={reviewAgentId}
              onChange={(e) => setReviewAgentId(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Select agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 'bold' }}>Steps</label>
            <button
              onClick={addStep}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + Add Step
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((step, index) => (
              <div
                key={step.id}
                style={{
                  padding: 16,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Step {index + 1}</span>
                  <button
                    onClick={() => removeStep(index)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--red)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                </div>
                <select
                  value={step.agentId}
                  onChange={(e) => updateStep(index, { agentId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    marginBottom: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Select agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <button
                      type="button"
                      onClick={() => updateStep(index, { input: step.input + '{{input}}' })}
                      style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                    >
                      + &#123;&#123;input&#125;&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStep(index, { input: step.input + '{{previous}}' })}
                      style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                      disabled={index === 0}
                      title={index === 0 ? 'Only available from step 2 onwards' : 'Output from previous step'}
                    >
                      + &#123;&#123;previous&#125;&#125;
                    </button>
                  </div>
                </div>
                <textarea
                  value={step.input}
                  onChange={(e) => updateStep(index, { input: e.target.value })}
                  placeholder={index === 0 ? 'Type {{input}} or write custom text...' : 'Type {{input}}, {{previous}}, or custom text...'}
                  style={{
                    width: '100%',
                    height: 60,
                    padding: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                  }}
                />
              </div>
            ))}
          </div>

          {steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 14 }}>
              No steps yet. Click "Add Step" to add one.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !name.trim() || steps.length === 0}
            style={{
              padding: '10px 20px',
              background: 'var(--green)',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: saving || !name.trim() || steps.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: saving || !name.trim() || steps.length === 0 ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !name.trim() || steps.length === 0}
            style={{
              padding: '10px 20px',
              background: 'var(--green)',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: saving || !name.trim() || steps.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: saving || !name.trim() || steps.length === 0 ? 0.5 : 1,
            }}
          >
            Save & Run
          </button>
        </div>
      </div>

      {showRunModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setShowRunModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: 24,
              borderRadius: 8,
              width: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Run Workflow</h3>
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="Enter input..."
              style={{
                width: '100%',
                height: 100,
                padding: 10,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRunModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => handleRun(showRunModal)}
                disabled={!runInput.trim()}
                style={{
                  padding: '8px 16px',
                  background: 'var(--green)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: runInput.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditWorkflowModalProps {
  workflow: Workflow;
  onClose: () => void;
  onSave: () => void;
}

function EditWorkflowModal({ workflow, onClose, onSave }: EditWorkflowModalProps) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [pattern, setPattern] = useState(workflow.pattern);
  const [combinePrompt, setCombinePrompt] = useState(workflow.combinePrompt || '');
  const [reviewAgentId, setReviewAgentId] = useState(workflow.reviewAgentId || '');
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow.steps);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      const data = await res.json();
      if (data.success) setAgents(data.data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const addStep = () => {
    setSteps([...steps, { id: `step-${steps.length + 1}`, agentId: agents[0]?.id || '', input: '' }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map((step, i) => (i === index ? { ...step, ...updates } : step)));
  };

  const handleSave = async () => {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, pattern, combinePrompt, reviewAgentId, steps }),
      });
      onSave();
    } catch (err) {
      console.error('Failed to update workflow:', err);
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-secondary)', padding: 24, borderRadius: 8, width: 700, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginBottom: 24, color: 'var(--green)' }}>Edit Workflow</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Pattern</label>
          <select value={pattern} onChange={(e) => setPattern(e.target.value as Workflow['pattern'])} style={{ width: '100%' }}>
            <option value="pipeline">Pipeline</option>
            <option value="fan-out">Fan-out</option>
            <option value="swarm">Swarm</option>
            <option value="review">Review</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Steps</label>
          {steps.map((step, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 4, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, width: '100%', marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => updateStep(index, { input: step.input + '{{input}}' })}
                  style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                >
                  + &#123;&#123;input&#125;&#125;
                </button>
                <button
                  type="button"
                  onClick={() => updateStep(index, { input: step.input + '{{previous}}' })}
                  style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                  disabled={index === 0}
                  title={index === 0 ? 'Only available from step 2 onwards' : 'Output from previous step'}
                >
                  + &#123;&#123;previous&#125;&#125;
                </button>
                <span style={{ padding: '2px 8px', fontSize: 10, color: 'var(--text-secondary)' }}>Step {step.id}</span>
              </div>
              <select value={step.agentId} onChange={(e) => updateStep(index, { agentId: e.target.value })} style={{ flex: 1 }}>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input value={step.input} onChange={(e) => updateStep(index, { input: e.target.value })} placeholder={index === 0 ? 'Type {{input}} or custom text...' : 'Type {{input}}, {{previous}}, or custom text...'} style={{ flex: 2 }} />
              <button onClick={() => removeStep(index)} style={{ padding: '4px 8px', background: 'var(--red)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>X</button>
            </div>
          ))}
          <button onClick={addStep} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}>+ Add Step</button>
        </div>

        {pattern === 'review' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Review Agent</label>
            <select value={reviewAgentId} onChange={(e) => setReviewAgentId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select agent</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {pattern === 'fan-out' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Combine Prompt</label>
            <textarea value={combinePrompt} onChange={(e) => setCombinePrompt(e.target.value)} placeholder="Combine the following results..." style={{ width: '100%', height: 80 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || steps.length === 0 || saving} style={{ padding: '10px 20px', background: 'var(--green)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

interface RunDetailsModalProps {
  run: WorkflowRun;
  onClose: () => void;
}

function RunDetailsModal({ run, onClose }: RunDetailsModalProps) {
  const steps = run.stepResults ? Object.entries(run.stepResults) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-secondary)', padding: 24, borderRadius: 8, width: 800, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'var(--green)' }}>Workflow Result</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20 }}>&times;</button>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Input:</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{run.input}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontWeight: 'bold', color: run.status === 'success' ? 'var(--green)' : 'var(--red)' }}>
            {run.status.toUpperCase()}
          </span>
          <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
            {run.totalTokens} tokens
          </span>
        </div>

        {steps.map(([stepId, step], index) => (
          <div key={stepId} style={{ marginBottom: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Step {index + 1} ({stepId})</span>
              <span style={{ fontSize: 12, color: step.status === 'success' ? 'var(--green)' : 'var(--red)' }}>
                {step.status} • {step.tokens} tokens • {step.durationMs}ms
              </span>
            </div>
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: 13, 
              padding: 8, 
              background: 'var(--bg-secondary)', 
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto'
            }}>
              {step.output || '(no output)'}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
