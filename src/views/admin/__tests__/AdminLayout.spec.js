import { test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: {}, tokenStorage: { leer: () => 't', guardar: () => {}, borrar: () => {} } }))

import AdminLayout from '@/views/admin/AdminLayout.vue'

beforeEach(() => setActivePinia(createPinia()))

test('el menú del administrador incluye Cabina (para tomar las fotos de las mascotas)', () => {
  const w = mount(AdminLayout, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, RouterView: true } } })
  const cabina = w.findAll('nav a').find((a) => a.text() === 'Cabina')
  expect(cabina).toBeTruthy()
  expect(cabina.attributes('href')).toBe('/cabina')
  expect(w.find('[data-test="ir-admin"]').exists()).toBe(false)
})
