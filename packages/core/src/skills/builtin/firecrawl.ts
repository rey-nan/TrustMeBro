import type { Skill, Tool, ToolInput, ToolOutput } from '../types.js';
import pino from 'pino';

const logger = pino({ name: 'FirecrawlSkill' });

// ═══════════════════════════════════════════════════════════
// Firecrawl Skill for TrustMeBro
// Supports: self-hosted (FIRECRAWL_API_URL) or cloud (FIRECRAWL_API_KEY)
// ═══════════════════════════════════════════════════════════

function getApiUrl(): string {
  // Self-hosted takes priority
  if (process.env.FIRECRAWL_API_URL) {
    return process.env.FIRECRAWL_API_URL;
  }
  // Cloud fallback
  return 'https://api.firecrawl.dev';
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Cloud requires API key
  if (process.env.FIRECRAWL_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  }
  return headers;
}

function isConfigured(): boolean {
  return !!(process.env.FIRECRAWL_API_URL || process.env.FIRECRAWL_API_KEY);
}

// ═══════════════════════════════════════════════════════════
// Tool 1: Search
// ═══════════════════════════════════════════════════════════

async function searchImpl(query: string, limit: number = 5, scrapeContent: boolean = false): Promise<ToolOutput> {
  if (!isConfigured()) {
    return { success: false, error: 'Firecrawl not configured. Set FIRECRAWL_API_URL (self-hosted) or FIRECRAWL_API_KEY (cloud) in .env' };
  }

  try {
    const url = `${getApiUrl()}/v2/search`;
    const body: Record<string, unknown> = { query, limit };

    if (scrapeContent) {
      body.scrapeOptions = { formats: ['markdown'] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Firecrawl search failed (${response.status}): ${errorText}` };
    }

    const data: any = await response.json();

    if (!data.success || !data.data?.web?.length) {
      return { success: true, result: 'No results found.' };
    }

    const results = data.data.web.map((r: any, i: number) => {
      let entry = `${i + 1}. ${r.title}\n   ${r.url}`;
      if (r.description) {
        entry += `\n   ${r.description}`;
      }
      if (scrapeContent && r.markdown) {
        entry += `\n   Content: ${r.markdown.substring(0, 500)}...`;
      }
      return entry;
    });

    return {
      success: true,
      result: `Search results for "${query}":\n\n${results.join('\n\n')}`,
      metadata: { count: data.data.web.length },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Search timeout (30s)' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
  }
}

// ═══════════════════════════════════════════════════════════
// Tool 2: Scrape (single URL)
// ═══════════════════════════════════════════════════════════

async function scrapeImpl(url: string, formats: string[] = ['markdown']): Promise<ToolOutput> {
  if (!isConfigured()) {
    return { success: false, error: 'Firecrawl not configured.' };
  }

  try {
    const apiUrl = `${getApiUrl()}/v2/scrape`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url, formats, onlyMainContent: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Scrape failed (${response.status}): ${errorText}` };
    }

    const data: any = await response.json();

    if (!data.success) {
      return { success: false, error: 'Scrape returned no data' };
    }

    const result: Record<string, unknown> = {};

    if (data.data?.markdown) {
      result.markdown = data.data.markdown.substring(0, 10000);
    }
    if (data.data?.html) {
      result.html = data.data.html.substring(0, 10000);
    }
    if (data.data?.metadata) {
      result.metadata = data.data.metadata;
    }

    return {
      success: true,
      result,
      metadata: { url, title: data.data?.metadata?.title },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Scrape timeout (30s)' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Scrape failed' };
  }
}

// ═══════════════════════════════════════════════════════════
// Tool 3: Crawl (multiple pages)
// ═══════════════════════════════════════════════════════════

async function crawlImpl(url: string, limit: number = 10, maxDepth: number = 2): Promise<ToolOutput> {
  if (!isConfigured()) {
    return { success: false, error: 'Firecrawl not configured.' };
  }

  try {
    const apiUrl = `${getApiUrl()}/v2/crawl`;

    // Start crawl job
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const startResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        url,
        limit,
        maxDepth,
        scrapeOptions: { formats: ['markdown'] },
      }),
      signal: controller.signal,
    });

    if (!startResponse.ok) {
      clearTimeout(timeout);
      const errorText = await startResponse.text();
      return { success: false, error: `Crawl start failed (${startResponse.status}): ${errorText}` };
    }

    const startData: any = await startResponse.json();

    if (!startData.success || !startData.id) {
      clearTimeout(timeout);
      return { success: false, error: 'Failed to start crawl job' };
    }

    // Poll for results
    const jobId = startData.id;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusResponse = await fetch(`${apiUrl}/${jobId}`, {
        method: 'GET',
        headers: getHeaders(),
        signal: controller.signal,
      });

      const statusData: any = await statusResponse.json();

      if (statusData.status === 'completed') {
        clearTimeout(timeout);

        const pages = (statusData.data || []).slice(0, 10).map((page: any, i: number) => {
          return `--- Page ${i + 1} ---\nURL: ${page.metadata?.sourceURL || 'unknown'}\nTitle: ${page.metadata?.title || 'untitled'}\n\n${(page.markdown || '').substring(0, 1000)}`;
        });

        return {
          success: true,
          result: `Crawl completed: ${statusData.completed} pages\n\n${pages.join('\n\n')}`,
          metadata: { totalPages: statusData.completed },
        };
      }

      if (statusData.status === 'failed') {
        clearTimeout(timeout);
        return { success: false, error: 'Crawl job failed' };
      }
    }

    clearTimeout(timeout);
    return { success: false, error: 'Crawl timeout (60s)' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Crawl timeout' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Crawl failed' };
  }
}

// ═══════════════════════════════════════════════════════════
// Tool 4: Extract (structured data)
// ═══════════════════════════════════════════════════════════

async function extractImpl(urls: string[], prompt: string, schema?: Record<string, unknown>): Promise<ToolOutput> {
  if (!isConfigured()) {
    return { success: false, error: 'Firecrawl not configured.' };
  }

  try {
    const apiUrl = `${getApiUrl()}/v2/extract`;

    const body: Record<string, unknown> = { urls, prompt };
    if (schema) {
      body.schema = schema;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    // Start extract job
    const startResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!startResponse.ok) {
      clearTimeout(timeout);
      const errorText = await startResponse.text();
      return { success: false, error: `Extract failed (${startResponse.status}): ${errorText}` };
    }

    const startData: any = await startResponse.json();

    if (!startData.success || !startData.id) {
      clearTimeout(timeout);
      return { success: false, error: 'Failed to start extract job' };
    }

    // Poll for results
    const jobId = startData.id;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const statusResponse = await fetch(`${apiUrl}/${jobId}`, {
        method: 'GET',
        headers: getHeaders(),
        signal: controller.signal,
      });

      const statusData: any = await statusResponse.json();

      if (statusData.status === 'completed') {
        clearTimeout(timeout);
        return {
          success: true,
          result: statusData.data,
        };
      }

      if (statusData.status === 'failed') {
        clearTimeout(timeout);
        return { success: false, error: 'Extract job failed' };
      }
    }

    clearTimeout(timeout);
    return { success: false, error: 'Extract timeout (60s)' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Extract timeout' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Extract failed' };
  }
}

// ═══════════════════════════════════════════════════════════
// Tool Definitions
// ═══════════════════════════════════════════════════════════

const firecrawlSearchTool: Tool = {
  definition: {
    name: 'firecrawl_search',
    description: 'Search the web using Firecrawl. Returns real search results with titles, URLs, and descriptions. Can also scrape full page content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'string',
          description: 'Number of results (default: 5, max: 10)',
        },
        scrapeContent: {
          type: 'string',
          description: 'Also scrape full page content from results (default: false)',
        },
      },
      required: ['query'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const query = input.query as string;
    const limit = parseInt(input.limit as string || '5', 10);
    const scrapeContent = input.scrapeContent === 'true' || input.scrapeContent === true;
    return searchImpl(query, Math.min(limit, 10), scrapeContent);
  },
};

const firecrawlScrapeTool: Tool = {
  definition: {
    name: 'firecrawl_scrape',
    description: 'Extract content from a single URL. Returns clean markdown, HTML, or structured data. Use this when you know exactly which page contains the information.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape',
        },
        formats: {
          type: 'string',
          description: 'Comma-separated formats: markdown,html,json (default: markdown)',
        },
      },
      required: ['url'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const url = input.url as string;
    const formats = (input.formats as string || 'markdown').split(',').map(f => f.trim());
    return scrapeImpl(url, formats);
  },
};

const firecrawlCrawlTool: Tool = {
  definition: {
    name: 'firecrawl_crawl',
    description: 'Crawl an entire website and extract content from multiple pages. Use when you need comprehensive coverage of a site.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The starting URL to crawl',
        },
        limit: {
          type: 'string',
          description: 'Max number of pages to crawl (default: 10)',
        },
        maxDepth: {
          type: 'string',
          description: 'Max crawl depth (default: 2)',
        },
      },
      required: ['url'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const url = input.url as string;
    const limit = parseInt(input.limit as string || '10', 10);
    const maxDepth = parseInt(input.maxDepth as string || '2', 10);
    return crawlImpl(url, limit, maxDepth);
  },
};

const firecrawlExtractTool: Tool = {
  definition: {
    name: 'firecrawl_extract',
    description: 'Extract structured data from web pages using AI. Provide URLs and a description of what data you want.',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'string',
          description: 'Comma-separated list of URLs to extract from',
        },
        prompt: {
          type: 'string',
          description: 'Description of what data to extract',
        },
      },
      required: ['urls', 'prompt'],
    },
  },
  execute: async (input: ToolInput): Promise<ToolOutput> => {
    const urls = (input.urls as string).split(',').map(u => u.trim());
    const prompt = input.prompt as string;
    return extractImpl(urls, prompt);
  },
};

// ═══════════════════════════════════════════════════════════
// Skill Export
// ═══════════════════════════════════════════════════════════

export const firecrawlSkill: Skill = {
  id: 'firecrawl',
  name: 'Firecrawl Web',
  description: 'Web search, scraping, crawling, and data extraction using Firecrawl (self-hosted or cloud)',
  tools: [firecrawlSearchTool, firecrawlScrapeTool, firecrawlCrawlTool, firecrawlExtractTool],
};
