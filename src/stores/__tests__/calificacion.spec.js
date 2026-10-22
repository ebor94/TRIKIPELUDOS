import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { clear, createStore } from 'idb-keyval'

const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwtDe = (id) => `h.${b64url({ id, scope: 'trk' })}.f`
const tokenActual = vi.hoisted(() => ({ valor: null }))
vi.mock('@/services/api', () => ({ api: {}, trk: { put: vi.fn(), post: vi.fn() }, tokenStorage: { leer: () => tokenActual.valor, guardar: () => {} } }))

vi.mock('@/utils/colaOffline', async (importOriginal) => {
  const real = await importOriginal()
  const hook = { ventana: null }
  // Tras la lectura (o antes del borrado atómico) deja entrar una escritura concurrente.
  const abrir = async () => {
    const f = hook.ventana
    hook.ventana = null
    if (f) await f()
  }
  return {
    ...real,
    __hook: hook,
    obtener: async (...a) => {
      const r = await real.obtener(...a)
      await abrir()
      return r
    },
    quitarSiVersion: async (...a) => {
      await abrir()
      return real.quitarSiVersion(...a)
    }
  }
})

import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useCalificacionStore } from '@/stores/calificacion'
import { useAuthStore } from '@/stores/auth'

const PUNTAJES = [{ criterio_id: 1, puntaje: 10 }]

beforeEach(async () => {
  setActivePinia(createPinia())
  useAuthStore().usuario = { id: 7 }
  tokenActual.valor = jwtDe(7)
  vi.clearAllMocks()
  await clear(createStore('trikipeludos', 'cola_calificaciones'))
})
afterEach(() => vi.useRealTimers())

test('envío exitoso no deja nada en la cola', async () => {
  trk.put.mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(trk.put).toHaveBeenCalledWith('/borradores/p1', { puntajes: PUNTAJES })
  expect(r.estado).toBe('GUARDADO')
  expect(await cola.listar(7)).toEqual([])
  expect(s.pendientes).toEqual({})
})

test('sin conexión queda pendiente de sincronizar (CA5) y sobrevive a recargar', async () => {
  trk.put.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
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
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  await s.cargarPendientes(8)
  expect(s.pendientes).toEqual({})
})

test('un 409/422 saca la calificación de la cola y se informa', async () => {
  trk.put.mockRejectedValue({ status: 409, motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(r).toMatchObject({ estado: 'RECHAZADA', error: { motivo: 'CALIFICACION_BLOQUEADA' } })
  expect(await cola.listar(7)).toEqual([])
})

test('reintento automático al volver la conexión', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1, bloqueada: true } })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  const detener = s.iniciarAutoSincronizacion(7)
  window.dispatchEvent(new Event('online'))
  await vi.waitFor(() => expect(s.pendientes).toEqual({}))
  detener()
})

test('reintento automático cada 10 s', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: { id: 1 } })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
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
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('PENDIENTE')
  expect(await cola.listar(7)).toHaveLength(1)
})

test('un 422 saca de la cola y marca RECHAZADA', async () => {
  trk.put.mockRejectedValue({ status: 422 })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('RECHAZADA')
  expect(await cola.listar(7)).toEqual([])
})

test('un error sin status (TypeError) queda PENDIENTE y en cola', async () => {
  trk.put.mockRejectedValue(new TypeError('x'))
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
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
  const a = s.guardarBorrador(7, 'p1', PUNTAJES)
  await vi.waitFor(() => expect(trk.put).toHaveBeenCalledTimes(1))
  await new Promise((r) => setTimeout(r, 5))
  const b = s.guardarBorrador(7, 'p1', NUEVOS)
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
  await s.guardarBorrador(7, 'p1', PUNTAJES)
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
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  s.reiniciar()
  expect(s.pendientes).toEqual({})
})

test('cargarPendientes no pierde lo encolado durante su espera', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  const carga = s.cargarPendientes(7)
  await s.guardarBorrador(7, 'p2', PUNTAJES)
  await carga
  expect(Object.keys(s.pendientes)).toEqual(['p2'])
})

test('ids numéricos y string son equivalentes en la cola', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador('7', 1, PUNTAJES)
  expect(await cola.listar(7)).toHaveLength(1)
  expect(await cola.listar('7')).toHaveLength(1)
})

test('quitarSiVersion: false y conserva si la versión difiere; true y borra si coincide', async () => {
  const item = await cola.encolar({ juradoId: 7, participanteId: 'p1', puntajes: PUNTAJES })
  expect(await cola.quitarSiVersion(7, 'p1', item.encoladaEn - 1)).toBe(false)
  expect(await cola.listar(7)).toHaveLength(1)
  expect(await cola.quitarSiVersion(7, 'p1', item.encoladaEn)).toBe(true)
  expect(await cola.listar(7)).toEqual([])
  expect(await cola.quitarSiVersion(7, 'p1', item.encoladaEn)).toBe(false)
})

test('una calificación nueva encolada entre la lectura y el borrado no se pierde', async () => {
  const NUEVOS = [{ criterio_id: 1, puntaje: 3 }]
  trk.put.mockImplementationOnce(async () => {
    cola.__hook.ventana = () => cola.encolar({ juradoId: 7, participanteId: 'p1', puntajes: NUEVOS })
    return { data: { id: 1 } }
  })
  const s = useCalificacionStore()
  const item = await cola.encolar({ juradoId: 7, participanteId: 'p1', puntajes: PUNTAJES })
  s.pendientes = { p1: item }
  await s.intentar(7, 'p1')
  const q = await cola.listar(7)
  expect(q).toHaveLength(1)
  expect(q[0].puntajes).toEqual(NUEVOS)
})

test('intentar sin item en la cola limpia pendientes en memoria', async () => {
  const s = useCalificacionStore()
  s.pendientes = { p1: { juradoId: '7', participanteId: 'p1', puntajes: PUNTAJES, encoladaEn: 1 } }
  const r = await s.intentar(7, 'p1')
  expect(r.estado).toBe('GUARDADO')
  expect(s.pendientes).toEqual({})
})

test('I1: no envía si el token que se enviaría (localStorage compartido) es de otro jurado', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  trk.put.mockClear()
  // Otra pestaña entró como el jurado 8: el token compartido cambió, pero esta pestaña sigue creyendo ser el 7.
  tokenActual.valor = jwtDe(8)
  await s.sincronizar(7)
  expect((await s.intentar(7, 'p1')).estado).toBe('PENDIENTE')
  expect(trk.put).not.toHaveBeenCalled()
  expect(await cola.listar(7)).toHaveLength(1)
})

test('I1: sin token o con token ilegible no envía', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  trk.put.mockClear()
  tokenActual.valor = null
  expect((await s.intentar(7, 'p1')).estado).toBe('PENDIENTE')
  tokenActual.valor = 'basura'
  expect((await s.intentar(7, 'p1')).estado).toBe('PENDIENTE')
  expect(trk.put).not.toHaveBeenCalled()
})

test('I3: un rechazo en la sincronización de fondo guarda motivo y mensaje por participante', async () => {
  trk.put.mockRejectedValueOnce({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  trk.put.mockRejectedValueOnce({ status: 409, motivo: 'CATEGORIA_CERRADA', message: 'La categoría está cerrada', errors: [] })
  await s.sincronizar(7)
  expect(s.pendientes).toEqual({})
  expect(s.rechazadas.p1).toEqual({ motivo: 'CATEGORIA_CERRADA', message: 'La categoría está cerrada' })
})

test('I3: reenviar limpia el rechazo previo; reiniciar también', async () => {
  trk.put.mockRejectedValueOnce({ status: 422, motivo: 'VALIDACION', message: 'Error', errors: [{ mensaje: 'Puntaje fuera de rango' }] })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(s.rechazadas.p1.message).toBe('Puntaje fuera de rango')
  trk.put.mockResolvedValueOnce({ data: { id: 1 } })
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(s.rechazadas.p1).toBeUndefined()
  s.rechazadas = { p2: { motivo: 'X', message: 'y' } }
  s.reiniciar()
  expect(s.rechazadas).toEqual({})
})

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

test('anotar escribe en IndexedDB al instante y envía una sola vez tras la pausa (autoguardado por fila, CA5)', async () => {
  trk.put.mockResolvedValue({ data: { participante_id: 'p1', borrador: { 1: 3 } } })
  const s = useCalificacionStore()
  await s.anotar(7, 'p1', [{ criterio_id: 1, puntaje: 2 }], 30)
  await s.anotar(7, 'p1', [{ criterio_id: 1, puntaje: 3 }], 30)
  expect(s.estados.p1).toBe('GUARDANDO')
  expect((await cola.obtener(7, 'p1')).puntajes).toEqual([{ criterio_id: 1, puntaje: 3 }])
  expect(trk.put).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(s.estados.p1).toBe('GUARDADO'))
  expect(trk.put).toHaveBeenCalledTimes(1)
  expect(trk.put).toHaveBeenCalledWith('/borradores/p1', { puntajes: [{ criterio_id: 1, puntaje: 3 }] })
  expect(s.pendientes).toEqual({})
})

test('sin red la fila queda "Sin conexión" y el borrador espera en el dispositivo (última escritura gana)', async () => {
  trk.put.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', [{ criterio_id: 1, puntaje: 2 }])
  await s.guardarBorrador(7, 'p1', [{ criterio_id: 1, puntaje: 5 }])
  expect(s.estados.p1).toBe('SIN_CONEXION')
  const q = await cola.listar(7)
  expect(q).toHaveLength(1)
  expect(q[0].puntajes).toEqual([{ criterio_id: 1, puntaje: 5 }])
})

test('409 CALIFICACION_BLOQUEADA marca la fila con ERROR, la informa y la saca de la cola', async () => {
  trk.put.mockRejectedValue({ status: 409, motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  const s = useCalificacionStore()
  const r = await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(r.estado).toBe('RECHAZADA')
  expect(s.estados.p1).toBe('ERROR')
  expect(s.rechazadas.p1).toEqual({ motivo: 'CALIFICACION_BLOQUEADA', message: 'Bloqueada' })
  expect(await cola.listar(7)).toEqual([])
})

test('reiniciar cancela los autoguardados programados y limpia los estados', async () => {
  const s = useCalificacionStore()
  await s.anotar(7, 'p1', PUNTAJES, 30)
  s.reiniciar()
  await espera(60)
  expect(trk.put).not.toHaveBeenCalled()
  expect(s.estados).toEqual({})
})

test('finalizar guarda antes lo pendiente de la categoría y luego llama a TRK-CAL-006 (CA6)', async () => {
  trk.put.mockRejectedValueOnce({ status: 0 }).mockResolvedValue({ data: {} })
  trk.post.mockResolvedValue({ data: { categoria_id: 1, calificaciones: [{ id: 1 }, { id: 2 }] } })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  expect(s.pendientes.p1).toBeTruthy()
  const r = await s.finalizar(7, 1, ['p1', 'p2'])
  expect(trk.put).toHaveBeenCalledTimes(2)
  expect(trk.post).toHaveBeenCalledWith('/calificaciones/finalizar', { categoria_id: 1 })
  expect(r.calificaciones).toHaveLength(2)
})

test('finalizar sin conexión no llama a TRK-CAL-006 y lo explica', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'SIN_CONEXION' })
  expect(trk.post).not.toHaveBeenCalled()
})

test('finalizar respeta la guarda de sesión: con otro jurado en la pestaña no envía nada', async () => {
  trk.put.mockRejectedValue({ status: 0 })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  trk.put.mockClear()
  useAuthStore().usuario = { id: 8 }
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'SIN_CONEXION' })
  expect(trk.put).not.toHaveBeenCalled()
  expect(trk.post).not.toHaveBeenCalled()
})

test('finalizar con una fila rechazada no envía y pide corregirla', async () => {
  trk.put.mockRejectedValue({ status: 422, motivo: 'PUNTAJE_FUERA_DE_RANGO', message: 'Fuera de rango' })
  const s = useCalificacionStore()
  await s.guardarBorrador(7, 'p1', PUNTAJES)
  await expect(s.finalizar(7, 1, ['p1'])).rejects.toMatchObject({ motivo: 'BORRADOR_RECHAZADO' })
  expect(trk.post).not.toHaveBeenCalled()
})
