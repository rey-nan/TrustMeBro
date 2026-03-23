// Use current hostname for API - works on localhost and network access
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = window.location.hostname;
  return `http://${host}:3000`;
};

const API_BASE = getApiBase();
const API_KEY = import.meta.env.VITE_API_KEY || '';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

async function apiCall<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json() as Promise<ApiResponse<T>>;
}

export const api = {
  get: <T>(path: string) => apiCall<T>('GET', path),
  post: <T>(path: string, body?: unknown) => apiCall<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => apiCall<T>('PUT', path, body),
  delete: <T>(path: string) => apiCall<T>('DELETE', path),
};

class WsClientClass {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageCallbacks: ((msg: WsMessage) => void)[] = [];
  private connected = false;

  connect() {
    const wsUrl = `${API_BASE.replace('http', 'ws')}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.connected = true;
        console.log('[WS] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          this.messageCallbacks.forEach((cb) => cb(msg));
        } catch {
          console.error('[WS] Failed to parse message');
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('[WS] Disconnected, reconnecting in 3s...');
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  onMessage(callback: (msg: WsMessage) => void) {
    this.messageCallbacks.push(callback);
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}

export const wsClient = new WsClientClass();
