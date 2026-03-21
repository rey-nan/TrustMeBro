import { randomUUID } from 'crypto';

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  pattern: 'pipeline' | 'fan-out' | 'swarm' | 'review';
  steps: {
    id: string;
    description: string;
    inputTemplate: string;
  }[];
  defaultInput?: string;
  tags: string[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'research-summarize',
    name: 'Research & Summarize',
    description: 'Search the web and create a summary',
    icon: '🔍',
    category: 'Research',
    pattern: 'pipeline',
    steps: [
      { id: 'search', description: 'Search for information', inputTemplate: 'Search the web for: {{input}}' },
      { id: 'summarize', description: 'Create summary', inputTemplate: 'Summarize this in 3-5 bullet points:\n{{previous}}' },
    ],
    tags: ['research', 'search', 'summary'],
  },
  {
    id: 'write-content',
    name: 'Write Content',
    description: 'Write articles, emails, or documentation',
    icon: '✍️',
    category: 'Writing',
    pattern: 'pipeline',
    steps: [
      { id: 'draft', description: 'Create first draft', inputTemplate: 'Write about: {{input}}' },
      { id: 'review', description: 'Review and improve', inputTemplate: 'Review and improve this text:\n{{previous}}' },
    ],
    tags: ['writing', 'content', 'articles'],
  },
  {
    id: 'translate',
    name: 'Translate Text',
    description: 'Translate text between languages',
    icon: '🌐',
    category: 'Language',
    pattern: 'pipeline',
    steps: [
      { id: 'translate', description: 'Translate the text', inputTemplate: 'Translate to Portuguese:\n{{input}}' },
    ],
    tags: ['translate', 'language'],
  },
  {
    id: 'analyze-code',
    name: 'Analyze Code',
    description: 'Review code and suggest improvements',
    icon: '💻',
    category: 'Development',
    pattern: 'pipeline',
    steps: [
      { id: 'analyze', description: 'Analyze the code', inputTemplate: 'Analyze this code for issues and improvements:\n{{input}}' },
      { id: 'suggest', description: 'Provide suggestions', inputTemplate: 'Based on the analysis, provide specific code improvements:\n{{previous}}' },
    ],
    tags: ['code', 'review', 'development'],
  },
  {
    id: 'debug-error',
    name: 'Debug Error',
    description: 'Analyze error messages and suggest fixes',
    icon: '🐛',
    category: 'Development',
    pattern: 'pipeline',
    steps: [
      { id: 'identify', description: 'Identify the problem', inputTemplate: 'Analyze this error and identify the root cause:\n{{input}}' },
      { id: 'fix', description: 'Suggest fix', inputTemplate: 'Provide a fix for this error:\n{{previous}}' },
    ],
    tags: ['debug', 'error', 'fix'],
  },
  {
    id: 'decompose-task',
    name: 'Decompose Task',
    description: 'Break complex tasks into smaller steps',
    icon: '📋',
    category: 'Planning',
    pattern: 'pipeline',
    steps: [
      { id: 'break', description: 'Break into steps', inputTemplate: 'Break this task into clear, actionable steps:\n{{input}}' },
      { id: 'prioritize', description: 'Prioritize steps', inputTemplate: 'Prioritize these steps by importance and dependencies:\n{{previous}}' },
    ],
    tags: ['planning', 'tasks', 'organization'],
  },
  {
    id: 'generate-docs',
    name: 'Generate Documentation',
    description: 'Create documentation from code or description',
    icon: '📄',
    category: 'Documentation',
    pattern: 'pipeline',
    steps: [
      { id: 'draft-docs', description: 'Draft documentation', inputTemplate: 'Write documentation for:\n{{input}}' },
      { id: 'format-docs', description: 'Format as markdown', inputTemplate: 'Format this as clean markdown documentation:\n{{previous}}' },
    ],
    tags: ['documentation', 'markdown'],
  },
  {
    id: 'test-api',
    name: 'Test API Endpoint',
    description: 'Test an HTTP API endpoint',
    icon: '🔌',
    category: 'Development',
    pattern: 'pipeline',
    steps: [
      { id: 'test', description: 'Test the endpoint', inputTemplate: 'Test this API endpoint and report results:\n{{input}}' },
      { id: 'report', description: 'Generate test report', inputTemplate: 'Create a test report:\n{{previous}}' },
    ],
    tags: ['api', 'testing', 'http'],
  },
];

export function getPresetById(id: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find((p) => p.id === id);
}

export function getPresetsByCategory(category: string): WorkflowPreset[] {
  return WORKFLOW_PRESETS.filter((p) => p.category === category);
}

export function searchPresets(query: string): WorkflowPreset[] {
  const lower = query.toLowerCase();
  return WORKFLOW_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.tags.some((t) => t.toLowerCase().includes(lower))
  );
}

export function getPresetCategories(): string[] {
  return [...new Set(WORKFLOW_PRESETS.map((p) => p.category))];
}
