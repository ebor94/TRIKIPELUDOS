import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => null, guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn((o) => { o.sincronizar(); return { conectado: { value: true } } }) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import PantallaView from '@/views/PantallaView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('modo pasarela: foto grande, nombre, disfraz y categoría (HU-9 CA1), sin login', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: { id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja', categoria: { nombre: 'Pequeños' }, foto_url: '/f.jpg' } } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(useTiempoReal.mock.calls[0][0].token).toBeNull()
  expect(w.text()).toContain('Canela')
  expect(w.text()).toContain('Bruja')
  expect(w.text()).toContain('Pequeños')
  expect(w.get('img[alt="Canela"]').attributes('src')).toBe('/f.jpg')
})

test('sin nadie en pasarela muestra el logo del evento', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: null } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.find('[data-test="logo"]').exists()).toBe(true)
})
