import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { clear, createStore } from 'idb-keyval'

vi.mock('@/services/api', () => ({ api: {}, trk: { put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useCalificacionStore } from '@/stores/calificacion'

const PUNTAJES = [{ criterio_id: 1, puntaje: 10 }]

beforeEach(async () => {
  setActivePinia(createPinia())
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

test('reintento automático al volver la conexión y cada 10 s', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  await s.enviar(7, 'p1', PUNTAJES)
  const detener = s.iniciarAutoSincronizacion(7)
  window.dispatchEvent(new Event('online'))
  await vi.waitFor(() => expect(s.pendientes).toEqual({}))
  detener()
})
