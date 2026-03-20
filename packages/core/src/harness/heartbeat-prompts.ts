export function buildWakePrompt(working: string, memory: string): string {
  return `You are waking up from sleep. Check your current state and any pending work.

## Current Work
${working || 'No current work recorded.'}

## Recent Memory
${memory || 'No recent memory.'}

## Your Task
Review your current work and memory. If there is ongoing work or pending tasks, continue working on them.
If there is no pending work, respond with exactly "HEARTBEAT_OK" and nothing else.

When reporting work progress, keep it concise (max 200 chars).`;
}

export function buildStandbyPrompt(): string {
  return `Check if there is any pending work to do. If none, respond with exactly "HEARTBEAT_OK".`;
}

export function parseHeartbeatResponse(response: string): {
  status: 'ok' | 'worked';
  summary: string;
} {
  const trimmed = response.trim().toUpperCase();

  if (trimmed === 'HEARTBEAT_OK') {
    return { status: 'ok', summary: 'No pending work' };
  }

  const summary = response.trim().slice(0, 500);
  return { status: 'worked', summary };
}
