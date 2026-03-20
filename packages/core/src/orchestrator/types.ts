export type OrchestrationPattern =
  | 'pipeline'
  | 'fan-out'
  | 'swarm'
  | 'review';

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface WorkflowStep {
  id: string;
  agentId: string;
  input: string;
  dependsOn?: string[];
  condition?: string;
  timeoutMs?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  pattern: OrchestrationPattern;
  steps: WorkflowStep[];
  combinePrompt?: string;
  reviewAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStepResult {
  agentId: string;
  status: WorkflowStatus;
  output: string;
  durationMs: number;
  tokens: number;
  startedAt: number;
  completedAt?: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  input: string;
  stepResults: Record<string, WorkflowStepResult>;
  finalOutput?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  totalTokens: number;
}

export interface WorkflowEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}
