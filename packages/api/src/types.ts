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
