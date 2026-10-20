import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }), useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import { mensajeDeError } from '@/utils/errores'
import CalificarView from '@/views/CalificarView.vue'

const RUBRICA = {
  categoria: { id: 1, nombre: 'Pequeños', abierta: true }, rubrica: { codigo: 'INDIVIDUAL' }, puntaje_total_max: 100,
  criterios: [
    { id: 1, nombre: 'Creatividad', descripcion: 'd1', puntaje_max: 35 }, { id: 2, nombre: 'Seguridad', descripcion: 'd2', puntaje_max: 30 },
    { id: 3, nombre: 'Elaboración', descripcion: 'd3', puntaje_max: 20 }, { id: 4, nombre: 'Pasarela', descripcion: 'd4', puntaje_max: 15 }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => {
    if (url === '/participantes/p1') return { data: { id: 'p1', mascota_nombre: 'Canela', categoria_id: 1, estado: 'EN_PASARELA', categoria: { nombre: 'Pequeños' } } }
    if (url === '/rubricas/1') return { data: RUBRICA }
    if (url === '/calificaciones/mias') return { data: [] }
    throw new Error(url)
  })
})

async function tocarTodos(w, valores = [30, 25, 15, 10]) {
  const rangos = w.findAll('input[type="range"]')
  for (const [i, v] of valores.entries()) await rangos[i].setValue(String(v))
}

test('muestra criterios de su categoría y total en vivo x / 100 (CA2, CA3)', async () => {
  const w = mount(CalificarView)
  await flushPromises()
  expect(w.text()).toContain('Canela')
  expect(w.findAll('input[type="range"]')).toHaveLength(4)
  expect(w.get('[data-test="total"]').text()).toBe('0 / 100')
  await tocarTodos(w)
  expect(w.get('[data-test="total"]').text()).toBe('80 / 100')
})

test('no se puede enviar con criterios sin tocar (CA4)', async () => {
  const w = mount(CalificarView)
  await flushPromises()
  const rangos = w.findAll('input[type="range"]')
  await rangos[0].setValue('10')
  expect(w.get('[data-test="enviar"]').attributes('disabled')).toBeDefined()
})

test('enviar pide confirmación y deja la calificación bloqueada', async () => {
  const s = useCalificacionStore()
  s.enviar = vi.fn(async () => ({ estado: 'ENVIADA', calificacion: { total: 80, bloqueada: true } }))
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(s.enviar).toHaveBeenCalledWith(7, 'p1', [{ criterio_id: 1, puntaje: 30 }, { criterio_id: 2, puntaje: 25 }, { criterio_id: 3, puntaje: 15 }, { criterio_id: 4, puntaje: 10 }])
  expect(w.text()).toContain('Calificación enviada')
  expect(w.find('input[type="range"]').exists()).toBe(false)
})

test('sin conexión muestra "pendiente de sincronizar" (CA5)', async () => {
  const s = useCalificacionStore()
  s.enviar = vi.fn(async () => ({ estado: 'PENDIENTE' }))
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Pendiente de sincronizar')
})

test('si ya la calificó, se muestra bloqueada sin controles', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/calificaciones/mias') return { data: [{ id: 3, participante_id: 'p1', total: 77, bloqueada: true }] }
    if (url === '/participantes/p1') return { data: { id: 'p1', mascota_nombre: 'Canela', categoria_id: 1, estado: 'PRESENTADO' } }
    return { data: RUBRICA }
  })
  const w = mount(CalificarView)
  await flushPromises()
  expect(w.text()).toContain('77 / 100')
  expect(w.find('input[type="range"]').exists()).toBe(false)
})

test('al sincronizar la cola deja de decir pendiente y muestra la calificación enviada', async () => {
  const s = useCalificacionStore()
  s.cargarPendientes = vi.fn(async () => {})
  s.iniciarAutoSincronizacion = vi.fn(() => () => {})
  s.enviar = vi.fn(async () => {
    s.pendientes = { p1: { participanteId: 'p1' } }
    return { estado: 'PENDIENTE' }
  })
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Pendiente de sincronizar')

  trk.get.mockImplementation(async (url) => {
    if (url === '/participantes/p1') return { data: { id: 'p1', mascota_nombre: 'Canela', categoria_id: 1, estado: 'EN_PASARELA', categoria: { nombre: 'Pequeños' } } }
    if (url === '/rubricas/1') return { data: RUBRICA }
    if (url === '/calificaciones/mias') return { data: [{ id: 9, participante_id: 'p1', total: 80, bloqueada: true }] }
    throw new Error(url)
  })
  s.pendientes = {}
  await flushPromises()
  expect(w.text()).toContain('Calificación enviada')
  expect(w.text()).not.toContain('Pendiente de sincronizar')
})

test('arranca la auto-sincronización antes de esperar la cola y la detiene si se desmonta antes', async () => {
  const s = useCalificacionStore()
  s.cargarPendientes = vi.fn(() => new Promise(() => {}))
  const parar = vi.fn()
  s.iniciarAutoSincronizacion = vi.fn(() => parar)
  const w = mount(CalificarView)
  expect(s.iniciarAutoSincronizacion).toHaveBeenCalledWith(7)
  w.unmount()
  expect(parar).toHaveBeenCalledTimes(1)
})

test('si enviar lanza un error inesperado se muestra en pantalla', async () => {
  const s = useCalificacionStore()
  s.cargarPendientes = vi.fn(async () => {})
  s.iniciarAutoSincronizacion = vi.fn(() => () => {})
  s.enviar = vi.fn(async () => { throw new Error('boom') })
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(mensajeDeError(new Error('boom')))
})

test('si la cola pendiente se vacía sin que el servidor la tenga, conserva los puntajes y avisa del rechazo', async () => {
  const s = useCalificacionStore()
  s.cargarPendientes = vi.fn(async () => {})
  s.iniciarAutoSincronizacion = vi.fn(() => () => {})
  s.enviar = vi.fn(async () => {
    s.pendientes = { p1: { participanteId: 'p1' } }
    return { estado: 'PENDIENTE' }
  })
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Pendiente de sincronizar')

  s.pendientes = {}
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe('La calificación pendiente no pudo registrarse; revisa los puntajes y vuelve a enviar.')
  expect(w.get('[data-test="total"]').text()).toBe('80 / 100')
  expect(w.findAll('input[type="range"]').map((r) => r.element.value)).toEqual(['30', '25', '15', '10'])
})

test('si el servidor rechaza la calificación al enviar, conserva los puntajes y muestra el motivo', async () => {
  const s = useCalificacionStore()
  s.enviar = vi.fn(async () => ({ estado: 'RECHAZADA', error: { message: 'Error', errors: [{ mensaje: 'La categoría ya no admite calificaciones' }] } }))
  const w = mount(CalificarView)
  await flushPromises()
  await tocarTodos(w)
  await w.get('[data-test="enviar"]').trigger('click')
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe('La categoría ya no admite calificaciones')
  expect(w.get('[data-test="total"]').text()).toBe('80 / 100')
  expect(w.findAll('input[type="range"]').map((r) => r.element.value)).toEqual(['30', '25', '15', '10'])
})
