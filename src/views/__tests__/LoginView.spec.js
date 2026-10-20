import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
  trk: { get: vi.fn(), post: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import LoginView from '@/views/LoginView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [{ id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO' }, { id: 4, nombre: 'Cabina', rol: 'TRK_CABINA' }] })
})

test('lista usuarios operativos y entra con PIN', async () => {
  trk.post.mockResolvedValue({ data: { token: 't', usuario: { id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO', permisos: { calificar: true } } } })
  const w = mount(LoginView)
  await flushPromises()
  expect(w.text()).toContain('Jurado Ana')
  await w.get('[data-test="usuario-3"]').trigger('click')
  await w.get('[data-test="pin"]').setValue('123456')
  await w.get('[data-test="entrar-pin"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/auth/pin', { usuario_id: 3, pin: '123456' })
  expect(push).toHaveBeenCalledWith('/jurado')
})

test('muestra el error del servidor', async () => {
  trk.post.mockRejectedValue({ status: 401, motivo: 'NO_AUTENTICADO', message: 'Usuario o PIN incorrecto' })
  const w = mount(LoginView)
  await flushPromises()
  await w.get('[data-test="usuario-4"]').trigger('click')
  await w.get('[data-test="pin"]').setValue('000000')
  await w.get('[data-test="entrar-pin"]').trigger('submit')
  await flushPromises()
  expect(w.text()).toContain('Usuario o PIN incorrecto')
})
