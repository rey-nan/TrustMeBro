import type { WebSocket } from 'ws';
import type { WsMessage } from '../types.js';

const clients: Set<WebSocket> = new Set();

export function handleConnection(socket: WebSocket): void {
  clients.add(socket);

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(socket);
  });

  socket.send(JSON.stringify({
    type: 'connected',
    payload: { message: 'Connected to TrustMeBro WebSocket' },
    timestamp: Date.now(),
  }));
}

export function broadcast(message: WsMessage): void {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
