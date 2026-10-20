import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import UsuariosView from '@/views/admin/UsuariosView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [{ id: 1, nombre: 'Jurado Ana', rol: 'TRK_JURADO', activo: true }] })
  window.confirm = vi.fn(() => true)
})

test('lista usuarios', async () => {
  const w = mount(UsuariosView)
  await flushPromises()
  expect(w.text()).toContain('Jurado Ana')
})

test('crear muestra el PIN una sola vez', async () => {
  trk.post.mockResolvedValue({ data: { usuario: { id: 2, nombre: 'Jurado Beto', rol: 'TRK_JURADO', activo: true }, pin: '482913' } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="nombre"]').setValue('Jurado Beto')
  await w.get('[data-test="rol"]').setValue('TRK_JURADO')
  await w.get('[data-test="crear"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/usuarios', { nombre: 'Jurado Beto', rol: 'TRK_JURADO' })
  expect(w.get('[data-test="pin-nuevo"]').text()).toContain('482913')
  await w.get('[data-test="cerrar-pin"]').trigger('click')
  expect(w.find('[data-test="pin-nuevo"]').exists()).toBe(false)
})

test('regenerar PIN pide confirmación', async () => {
  trk.post.mockResolvedValue({ data: { pin: '111222' } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="regenerar-1"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/usuarios/1/pin')
  expect(w.text()).toContain('111222')
})

test('activar/desactivar', async () => {
  trk.patch.mockResolvedValue({ data: { id: 1, nombre: 'Jurado Ana', rol: 'TRK_JURADO', activo: false } })
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="activo-1"]').trigger('click')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/usuarios/1', { activo: false })
  expect(w.text()).toContain('Inactivo')
})

test('doble toque en Crear no crea dos usuarios: el botón se deshabilita mientras la petición está en curso', async () => {
  let soltar
  trk.post.mockImplementation(() => new Promise((res) => { soltar = () => res({ data: { usuario: { id: 2, nombre: 'Jurado Beto', rol: 'TRK_JURADO', activo: true }, pin: '482913' } }) }))
  const w = mount(UsuariosView)
  await flushPromises()
  await w.get('[data-test="nombre"]').setValue('Jurado Beto')
  await w.get('[data-test="crear"]').trigger('submit')
  await w.get('[data-test="crear"]').trigger('submit')
  expect(trk.post).toHaveBeenCalledTimes(1)
  expect(w.get('[data-test="crear"] button[type="submit"]').attributes('disabled')).toBeDefined()
  soltar()
  await flushPromises()
  expect(w.get('[data-test="crear"] button[type="submit"]').attributes('disabled')).toBeUndefined()
})
