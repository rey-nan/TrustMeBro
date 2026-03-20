import type { Skill, Tool, ToolInput, ToolOutput } from '../types.js';

const MAX_BODY_SIZE = 10 * 1024;

async function httpGetImpl(url: string, headers?: Record<string, string>): Promise<ToolOutput> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'TrustMeBro/1.0',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let body = await response.text();

    if (body.length > MAX_BODY_SIZE) {
      body = body.slice(0, MAX_BODY_SIZE) + '\n[Response truncated]';
    }

    return {
      success: true,
      result: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timeout (15s exceeded)' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}

async function httpPostImpl(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<ToolOutput> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'TrustMeBro/1.0',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let responseBody = await response.text();

    if (responseBody.length > MAX_BODY_SIZE) {
      responseBody = responseBody.slice(0, MAX_BODY_SIZE) + '\n[Response truncated]';
    }

    return {
      success: true,
      result: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timeout (15s exceeded)' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}

const httpGetTool: Tool = {
  definition: {
    name: 'http_get',
    description: 'Make an HTTP GET request',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
      },
      required: ['url'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const url = input.url as string;
    const headers = input.headers as Record<string, string> | undefined;

    if (!url) {
      return { success: false, error: 'URL parameter is required' };
    }

    return httpGetImpl(url, headers);
  },
};

const httpPostTool: Tool = {
  definition: {
    name: 'http_post',
    description: 'Make an HTTP POST request with JSON body',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to POST to',
        },
        body: {
          type: 'object',
          description: 'The JSON body to send',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
      },
      required: ['url', 'body'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const url = input.url as string;
    const body = input.body;
    const headers = input.headers as Record<string, string> | undefined;

    if (!url) {
      return { success: false, error: 'URL parameter is required' };
    }

    return httpPostImpl(url, body, headers);
  },
};

export const httpRequestSkill: Skill = {
  id: 'http_request',
  name: 'HTTP Request',
  description: 'Make HTTP GET and POST requests',
  tools: [httpGetTool, httpPostTool],
};
