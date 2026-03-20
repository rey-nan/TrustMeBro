import { useEffect, useState, useRef } from 'react';
import { wsClient, type WsMessage } from '../api/client';

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const messagesRef = useRef<WsMessage[]>([]);

  useEffect(() => {
    const callback = (msg: WsMessage) => {
      setLastMessage(msg);
      messagesRef.current = [...messagesRef.current.slice(-99), msg];
    };
    
    wsClient.onMessage(callback);

    return () => {
      // Remove this callback (simplified - in production use a proper cleanup)
    };
  }, []);

  return {
    lastMessage,
    connected: wsClient.isConnected(),
    messages: messagesRef.current,
  };
}
