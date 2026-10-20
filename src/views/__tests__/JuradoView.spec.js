import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn((o) => { o.sincronizar(); return { conectado: { value: true } } }) }))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import JuradoView from '@/views/JuradoView.vue'

const toby = { id: 't', mascota_nombre: 'Toby', estado: 'EN_PASARELA', categoria: { nombre: 'Pequeños' } }
const kira = { id: 'k', mascota_nombre: 'Kira', estado: 'PRESENTADO', categoria: { nombre: 'Pequeños' } }
const luna = { id: 'l', mascota_nombre: 'Luna', estado: 'PRESENTADO', categoria: { nombre: 'Felinos' } }
const rex = { id: 'r', mascota_nombre: 'Rex', estado: 'PRESENTE', categoria: { nombre: 'Grandes' } }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/calificaciones/mias') return { data: [{ participante_id: 'k', total: 80, bloqueada: true }] }
    return { data: [toby, kira, luna, rex] }
  })
})

test('por defecto muestra la mascota en pasarela con botón Calificar (CA1)', async () => {
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="en-pasarela"]').text()).toContain('Toby')
  await w.get('[data-test="calificar-en-pasarela"]').trigger('click')
  expect(push).toHaveBeenCalledWith('/jurado/calificar/t')
})

test('galería con insignias Calificada / Por sincronizar / Pendiente y mascotas aún no calificables', async () => {
  useCalificacionStore().pendientes = { l: { participanteId: 'l' } }
  useCalificacionStore().cargarPendientes = vi.fn(async () => {})
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="insignia-k"]').text()).toBe('Calificada')
  expect(w.get('[data-test="insignia-l"]').text()).toBe('Por sincronizar')
  expect(w.get('[data-test="insignia-t"]').text()).toBe('Pendiente')
  expect(w.get('[data-test="insignia-r"]').text()).toBe('Aún no sale')
})

test('al sincronizar la cola (sale de pendientes) recarga las calificadas y la insignia pasa a Calificada', async () => {
  const cola = useCalificacionStore()
  cola.cargarPendientes = vi.fn(async () => {})
  cola.iniciarAutoSincronizacion = vi.fn(() => () => {})
  cola.pendientes = { l: { participanteId: 'l' } }
  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/calificaciones/mias') return { data: [] }
    return { data: [toby, kira, luna, rex] }
  })
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="insignia-l"]').text()).toBe('Por sincronizar')

  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/calificaciones/mias') return { data: [{ participante_id: 'l', total: 80, bloqueada: true }] }
    return { data: [toby, kira, luna, rex] }
  })
  cola.pendientes = {}
  await flushPromises()
  expect(w.get('[data-test="insignia-l"]').text()).toBe('Calificada')
})

test('arranca la auto-sincronización antes de leer la cola local y la detiene al desmontar aunque aún no haya respondido', async () => {
  const cola = useCalificacionStore()
  const detener = vi.fn()
  cola.iniciarAutoSincronizacion = vi.fn(() => detener)
  cola.cargarPendientes = vi.fn(() => new Promise(() => {}))
  const w = mount(JuradoView)
  await flushPromises()
  expect(cola.iniciarAutoSincronizacion).toHaveBeenCalledWith(7)
  w.unmount()
  expect(detener).toHaveBeenCalledTimes(1)
})

test('un error al leer la cola local no impide la auto-sincronización', async () => {
  const cola = useCalificacionStore()
  const detener = vi.fn()
  cola.iniciarAutoSincronizacion = vi.fn(() => detener)
  cola.cargarPendientes = vi.fn(async () => { throw new Error('IndexedDB bloqueada') })
  const w = mount(JuradoView)
  await flushPromises()
  expect(cola.iniciarAutoSincronizacion).toHaveBeenCalledWith(7)
  w.unmount()
  expect(detener).toHaveBeenCalledTimes(1)
})

test('I3: una calificación rechazada en segundo plano muestra insignia Rechazada y el motivo', async () => {
  const cola = useCalificacionStore()
  cola.cargarPendientes = vi.fn(async () => {})
  cola.iniciarAutoSincronizacion = vi.fn(() => () => {})
  cola.rechazadas = { l: { motivo: 'CATEGORIA_CERRADA', message: 'La categoría está cerrada' } }
  const w = mount(JuradoView)
  await flushPromises()
  expect(w.get('[data-test="insignia-l"]').text()).toBe('Rechazada')
  expect(w.get('[data-test="rechazadas"]').text()).toContain('Luna')
  expect(w.get('[data-test="rechazadas"]').text()).toContain('La categoría está cerrada')
})
