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
  await vi.advanceTimersByTimeAsync(3000)
  expect(sincronizar).toHaveBeenCalledTimes(2)
  socket.emitir('connect')
  expect(rt.conectado.value).toBe(true)
  const tras = sincronizar.mock.calls.length
  vi.advanceTimersByTime(9000)
  expect(sincronizar.mock.calls.length).toBe(tras)
})

test('si el socket cae vuelve al polling cada 3 s (RNF-2)', async () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  sincronizar.mockClear()
  socket.emitir('disconnect')
  expect(rt.conectado.value).toBe(false)
  await vi.advanceTimersByTimeAsync(6000)
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

test('iniciar dos veces no crea un segundo socket', () => {
  const socket = socketFalso()
  const conectar = vi.fn(() => socket)
  const rt = useTiempoReal({ sincronizar: async () => {}, conectar, automatico: false })
  rt.iniciar()
  rt.iniciar()
  expect(conectar).toHaveBeenCalledTimes(1)
})

test('detener apaga el polling y deja conectado en false', () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  socket.emitir('disconnect')
  rt.detener()
  sincronizar.mockClear()
  vi.advanceTimersByTime(9000)
  expect(sincronizar).not.toHaveBeenCalled()
  expect(rt.conectado.value).toBe(false)
  expect(socket.removeAllListeners).toHaveBeenCalled()
  expect(socket.disconnect).toHaveBeenCalled()
})

test('no solapa polls: si sincronizar sigue en curso se salta el tick', () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(() => new Promise(() => {}))
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  vi.advanceTimersByTime(9000)
  expect(sincronizar).toHaveBeenCalledTimes(1)
})

test('connect_error inicia el polling', async () => {
  const socket = socketFalso()
  const sincronizar = vi.fn(async () => {})
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  sincronizar.mockClear()
  socket.emitir('connect_error', new Error('caida'))
  await vi.advanceTimersByTimeAsync(3000)
  expect(sincronizar).toHaveBeenCalled()
})

test('detener con socket conectado deja conectado en false', () => {
  const socket = socketFalso()
  const rt = useTiempoReal({ sincronizar: async () => {}, conectar: () => socket, automatico: false })
  rt.iniciar()
  socket.emitir('connect')
  expect(rt.conectado.value).toBe(true)
  rt.detener()
  expect(rt.conectado.value).toBe(false)
})

test('I2: un 401 en el polling no se traga: detiene el polling y avisa', async () => {
  const socket = socketFalso()
  const err = { status: 401, motivo: 'NO_AUTENTICADO' }
  const sincronizar = vi.fn(async () => { throw err })
  const alNoAutenticado = vi.fn()
  const rt = useTiempoReal({ sincronizar, conectar: () => socket, automatico: false, alNoAutenticado })
  rt.iniciar()
  await vi.advanceTimersByTimeAsync(0)
  expect(alNoAutenticado).toHaveBeenCalledWith(err)
  sincronizar.mockClear()
  await vi.advanceTimersByTimeAsync(9000)
  expect(sincronizar).not.toHaveBeenCalled()
})
