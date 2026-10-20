import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTiempoReal } from '@/composables/useTiempoReal'

function socketFalso() {
  const handlers = {}
  return {
    handlers,
    on: vi.fn((e, h) => { (handlers[e] ||= []).push(h) }),
    emitir: (e, ...a) => (handlers[e] || []).forEach((h) => h(...a)),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('sincroniza al iniciar y hace polling hasta que el socket conecta', async () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ token: 't', sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  expect(sincronizar).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(3000)
  expect(sincronizar).toHaveBeenCalledTimes(2)
  socket.emitir('connect')
  expect(rt.conectado.value).toBe(true)
  const tras = sincronizar.mock.calls.length
  vi.advanceTimersByTime(9000)
  expect(sincronizar.mock.calls.length).toBe(tras)
})

test('si el socket cae vuelve al polling cada 3 s (RNF-2)', () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  sincronizar.mockClear()
  socket.emitir('disconnect')
  expect(rt.conectado.value).toBe(false)
  vi.advanceTimersByTime(6000)
  expect(sincronizar).toHaveBeenCalledTimes(2)
})

test('registra handlers de eventos y limpia al detener', () => {
  const socket = socketFalso()
  const alCambio = vi.fn()
  const rt = useTiempoReal({ eventos: { 'pasarela:cambio': alCambio }, sincronizar: async () => {}, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('pasarela:cambio', { participante: { id: 'x' } })
  expect(alCambio).toHaveBeenCalledWith({ participante: { id: 'x' } })
  rt.detener()
  expect(socket.disconnect).toHaveBeenCalled()
})
