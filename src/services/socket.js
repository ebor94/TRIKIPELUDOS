import { io } from 'socket.io-client'

export function conectarSocket(token) {
  const base = import.meta.env.VITE_SOCKET_URL || window.location.origin
  return io(`${base}/trk`, {
    path: '/socket.io',
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  })
}
