import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))

import { trk } from '@/services/api'
import TableroView from '@/views/admin/TableroView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: {
    calificables: 2,
    categorias: [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true, ranking_publicado: false, total: 2, por_estado: { INSCRITO: 0, PRESENTE: 0, EN_PASARELA: 1, PRESENTADO: 1, AUSENTE: 0 } }],
    jurados: [{ id: 5, nombre: 'J1', activo: true, calificadas: 1, pendientes: 1 }]
  } })
})

test('muestra contadores y progreso por jurado', async () => {
  const w = mount(TableroView)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/evento/tablero')
  expect(w.text()).toContain('Pequeños')
  expect(w.text()).toContain('J1')
  expect(w.text()).toContain('1 / 2')
})

test('cambia la pantalla a modo pasarela', async () => {
  trk.put.mockResolvedValue({ data: { modo_pantalla: 'PASARELA' } })
  const w = mount(TableroView)
  await flushPromises()
  await w.get('[data-test="pantalla-pasarela"]').trigger('click')
  expect(trk.put).toHaveBeenCalledWith('/evento/pantalla', { modo: 'PASARELA' })
})

test('el enlace "Abrir pantalla" respeta la base /trikipeludos/', async () => {
  const w = mount(TableroView)
  await flushPromises()
  const enlace = w.get('[data-test="abrir-pantalla"]')
  expect(enlace.attributes('href')).toBe(`${import.meta.env.BASE_URL}pantalla`)
  expect(enlace.attributes('href').startsWith(import.meta.env.BASE_URL)).toBe(true)
})

test('los botones de la cabecera envuelven en pantallas de 360 px', async () => {
  const w = mount(TableroView)
  await flushPromises()
  expect(w.get('[data-test="abrir-pantalla"]').element.parentElement.className).toContain('flex-wrap')
})
