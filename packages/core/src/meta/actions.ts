export interface TrustMeBroAction {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  response: string;
  requiresApi?: boolean;
  apiEndpoint?: string;
}

export const TRUSTMEBRO_ACTIONS: TrustMeBroAction[] = [
  {
    id: 'dashboard-url',
    name: 'Dashboard URL',
    description: 'Get the dashboard URL',
    triggers: ['dashboard', 'link', 'url', 'endereco', 'onde acesso', 'como acesso'],
    response: 'The dashboard is at: http://localhost:5173\nThe API is at: http://localhost:3000',
  },
  {
    id: 'system-status',
    name: 'System Status',
    description: 'Check system status',
    triggers: ['status', 'como esta', 'esta funcionando', 'rodando'],
    requiresApi: true,
    apiEndpoint: '/api/status',
    response: 'Checking system status...',
  },
  {
    id: 'list-agents',
    name: 'List Agents',
    description: 'Show all agents',
    triggers: ['listar agentes', 'quais agentes', 'meus agentes'],
    requiresApi: true,
    apiEndpoint: '/api/agents',
    response: 'Listing your agents...',
  },
  {
    id: 'telegram-status',
    name: 'Telegram Status',
    description: 'Check if Telegram is configured',
    triggers: ['telegram', 'telegram configurado'],
    requiresApi: true,
    apiEndpoint: '/api/status',
    response: 'Checking Telegram configuration...',
  },
  {
    id: 'token-usage',
    name: 'Token Usage',
    description: 'Check token consumption today',
    triggers: ['tokens', 'consumo', 'uso', 'custo'],
    requiresApi: true,
    apiEndpoint: '/api/consumption/today',
    response: 'Checking token usage...',
  },
];

export function matchAction(input: string): TrustMeBroAction | null {
  const lower = input.toLowerCase();
  for (const action of TRUSTMEBRO_ACTIONS) {
    for (const trigger of action.triggers) {
      if (lower.includes(trigger)) {
        return action;
      }
    }
  }
  return null;
}
