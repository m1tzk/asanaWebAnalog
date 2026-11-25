import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function createSocket(username) {
  return io(SOCKET_URL, {
    auth: { username },
    autoConnect: true,
    reconnectionAttempts: 5
  });
}