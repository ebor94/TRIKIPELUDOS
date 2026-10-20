import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { conectarSocket } from '@/services/socket'

// Socket.IO con respaldo de polling REST (RNF-2): mientras no haya socket, llama a `sincronizar` cada intervaloMs.
export function useTiempoReal({ token = null, eventos = {}, sincronizar = null, intervaloMs = 3000, conectar = conectarSocket, automatico = true } = {}) {
  const conectado = ref(false)
  let socket = null
  let temporizador = null

  let enVuelo = false
  const correr = async () => {
    if (!sincronizar || enVuelo) return
    enVuelo = true
    try { await sincronizar() } catch {} finally { enVuelo = false }
  }
  const iniciarPolling = () => { if (!temporizador) temporizador = setInterval(correr, intervaloMs) }
  const detenerPolling = () => { clearInterval(temporizador); temporizador = null }

  function iniciar() {
    if (socket) return
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
    conectado.value = false
  }

  if (automatico && getCurrentInstance()) {
    onMounted(iniciar)
    onBeforeUnmount(detener)
  }
  return { conectado, iniciar, detener }
}
