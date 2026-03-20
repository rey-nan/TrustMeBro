import { useEffect, useState, useRef } from 'react';
import { wsClient, type WsMessage } from '../api/client';

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const messagesRef = useRef<WsMessage[]>([]);

  useEffect(() => {
    wsClient.onMessage((msg) => {
      setLastMessage(msg);
      messagesRef.current = [...messagesRef.current.slice(-99), msg];
    });

    wsClient.connect();

    return () => {
      wsClient.disconnect();
    };
  }, []);

  return {
    lastMessage,
    connected: wsClient.isConnected(),
    messages: messagesRef.current,
  };
}
