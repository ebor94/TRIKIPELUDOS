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
