import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { clear, createStore } from 'idb-keyval'

vi.mock('@/services/api', () => ({ api: {}, trk: { put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useCalificacionStore } from '@/stores/calificacion'
import { useAuthStore } from '@/stores/auth'

const PUNTAJES = [{ criterio_id: 1, puntaje: 10 }]

beforeEach(async () => {
  setActivePinia(createPinia())
  useAuthStore().usuario = { id: 7 }
  vi.clearAllMocks()
  await clear(createStore('trikipeludos', 'cola_calificaciones'))
})
afterEach(() => vi.useRealTimers())

test('envío exitoso no deja nada en la cola', async () => {
  trk.put.mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(trk.put).toHaveBeenCalledWith('/calificaciones/p1', { puntajes: PUNTAJES })
  expect(r.estado).toBe('ENVIADA')
  expect(await cola.listar(7)).toEqual([])
  expect(s.pendientes).toEqual({})
})

test('sin conexión queda pendiente de sincronizar (CA5) y sobrevive a recargar', async () => {
  trk.put.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('PENDIENTE')
  expect(s.pendientes.p1.puntajes).toEqual(PUNTAJES)
  setActivePinia(createPinia())
  useAuthStore().usuario = { id: 7 }
  const s2 = useCalificacionStore()
  await s2.cargarPendientes(7)
  expect(Object.keys(s2.pendientes)).toEqual(['p1'])
})

test('la cola es por jurado', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  await s.cargarPendientes(8)
  expect(s.pendientes).toEqual({})
})

test('un 409/422 saca la calificación de la cola y se informa', async () => {
  trk.put.mockRejectedValue({ status: 409, motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r).toMatchObject({ estado: 'RECHAZADA', error: { motivo: 'CALIFICACION_BLOQUEADA' } })
  expect(await cola.listar(7)).toEqual([])
})

test('reintento automático al volver la conexión', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  const detener = s.iniciarAutoSincronizacion(7)
  window.dispatchEvent(new Event('online'))
  await vi.waitFor(() => expect(s.pendientes).toEqual({}))
  detener()
})

test('reintento automático cada 10 s', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1 } })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  expect(trk.put).toHaveBeenCalledTimes(1)
  const detener = s.iniciarAutoSincronizacion(7)
  vi.advanceTimersByTime(10000)
  await vi.waitFor(() => expect(trk.put).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(s.pendientes).toEqual({}))
  detener()
})

test.each([401, 408, 429, 503])('un %i mantiene la calificación pendiente', async (status) => {
  trk.put.mockRejectedValue({ status })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('PENDIENTE')
  expect(await cola.listar(7)).toHaveLength(1)
})

test('un 422 saca de la cola y marca RECHAZADA', async () => {
  trk.put.mockRejectedValue({ status: 422 })
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('RECHAZADA')
  expect(await cola.listar(7)).toEqual([])
})

test('un error sin status (TypeError) queda PENDIENTE y en cola', async () => {
  trk.put.mockRejectedValue(new TypeError('x'))
  const s = useCalificacionStore()
  const r = await s.enviar(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('PENDIENTE')
  expect(await cola.listar(7)).toHaveLength(1)
  expect(s.pendientes.p1).toBeTruthy()
})

test('una respuesta vieja no borra una calificación más nueva del mismo participante', async () => {
  const NUEVOS = [{ criterio_id: 1, puntaje: 3 }]
  let soltarA
  trk.put
    .mockImplementationOnce(() => new Promise((res) => { soltarA = () => res({ data: { id: 1 } }) }))
    .mockRejectedValueOnce({ status: 0 })
  const s = useCalificacionStore()
  const a = s.enviar(7, 'p1', PUNTAJES)
  await vi.waitFor(() => expect(trk.put).toHaveBeenCalledTimes(1))
  await new Promise((r) => setTimeout(r, 5))
  const b = s.enviar(7, 'p1', NUEVOS)
  await new Promise((r) => setTimeout(r, 5))
  soltarA()
  await Promise.all([a, b])
  const q = await cola.listar(7)
  expect(q).toHaveLength(1)
  expect(q[0].puntajes).toEqual(NUEVOS)
  expect(s.pendientes.p1.puntajes).toEqual(NUEVOS)
})

test('no envía items de otro jurado en la sesión actual', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  trk.put.mockClear()
  useAuthStore().usuario = { id: 8 }
  await s.sincronizar(7)
  expect(trk.put).not.toHaveBeenCalled()
  expect(await cola.listar(7)).toHaveLength(1)
  expect((await s.intentar(7, 'p1')).estado).toBe('PENDIENTE')
  expect(trk.put).not.toHaveBeenCalled()
})

test('reiniciar vacía pendientes', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  s.reiniciar()
  expect(s.pendientes).toEqual({})
})

test('cargarPendientes no pierde lo encolado durante su espera', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  const carga = s.cargarPendientes(7)
  await s.enviar(7, 'p2', PUNTAJES)
  await carga
  expect(Object.keys(s.pendientes)).toEqual(['p2'])
})

test('ids numéricos y string son equivalentes en la cola', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.enviar('7', 1, PUNTAJES)
  expect(await cola.listar(7)).toHaveLength(1)
  expect(await cola.listar('7')).toHaveLength(1)
})
