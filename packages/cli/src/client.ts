import { CliConfig } from './config.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export class ApiClient {
  private config: CliConfig;
  private baseUrl: string;

  constructor(config: CliConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    return headers;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`);
      }

      const data = await response.json() as ApiResponse<T>;

      if (!data.success) {
        throw new Error(data.error || 'Unknown API error');
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Cannot connect to TrustMeBro API at ${this.baseUrl}\n` +
          `  Make sure the server is running: npm run dev:api`
        );
      }
      throw error;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
