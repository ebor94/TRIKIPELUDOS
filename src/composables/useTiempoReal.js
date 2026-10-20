import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { conectarSocket } from '@/services/socket'

// Socket.IO con respaldo de polling REST (RNF-2): mientras no haya socket, llama a `sincronizar` cada intervaloMs.
export function useTiempoReal({ token = null, eventos = {}, sincronizar = null, intervaloMs = 3000, conectar = conectarSocket, automatico = true } = {}) {
  const conectado = ref(false)
  let socket = null
  let temporizador = null

  const correr = () => { if (sincronizar) Promise.resolve(sincronizar()).catch(() => {}) }
  const iniciarPolling = () => { if (!temporizador) temporizador = setInterval(correr, intervaloMs) }
  const detenerPolling = () => { clearInterval(temporizador); temporizador = null }

  function iniciar() {
    socket = conectar(token)
    socket.on('connect', () => { conectado.value = true; detenerPolling(); correr() })
    socket.on('disconnect', () => { conectado.value = false; iniciarPolling() })
    socket.on('connect_error', () => { conectado.value = false; iniciarPolling() })
    for (const [evento, handler] of Object.entries(eventos)) socket.on(evento, handler)
    correr()
    iniciarPolling()
  }

  function detener() {
    detenerPolling()
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
  }

  if (automatico && getCurrentInstance()) {
    onMounted(iniciar)
    onBeforeUnmount(detener)
  }
  return { conectado, iniciar, detener }
}
