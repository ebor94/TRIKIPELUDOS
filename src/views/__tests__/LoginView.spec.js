import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
const ruta = vi.hoisted(() => ({ query: {} }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push, replace: push }), useRoute: () => ruta }))
const tokenGuardado = vi.hoisted(() => ({ valor: null }))
vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
  trk: { get: vi.fn(), post: vi.fn() },
  tokenStorage: { leer: () => tokenGuardado.valor, guardar: (t) => { tokenGuardado.valor = t } }
}))

import { trk } from '@/services/api'
import LoginView from '@/views/LoginView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  ruta.query = {}
  tokenGuardado.valor = null
  localStorage.clear()
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

test('I2: tras una sesión expirada muestra el aviso visible', async () => {
  ruta.query = { motivo: 'SESION_EXPIRADA', redirect: '/jurado' }
  const w = mount(LoginView)
  await flushPromises()
  expect(w.get('[data-test="sesion-expirada"]').text()).toContain('Tu sesión expiró, vuelve a ingresar')
})

test('redirect en forma de arreglo se normaliza a texto', async () => {
  ruta.query = { redirect: ['/jurado/calificar/p1', '/x'] }
  trk.post.mockResolvedValue({ data: { token: 't', usuario: { id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO', permisos: { calificar: true } } } })
  const w = mount(LoginView)
  await flushPromises()
  await w.get('[data-test="usuario-3"]').trigger('click')
  await w.get('[data-test="pin"]').setValue('123456')
  await w.get('[data-test="entrar-pin"]').trigger('submit')
  await flushPromises()
  expect(push).toHaveBeenCalledWith('/jurado/calificar/p1')
})

test('I5: con sesión guardada (aunque no haya conexión) /login lleva a su pantalla de inicio', async () => {
  tokenGuardado.valor = `h.${btoa(JSON.stringify({ id: 3 })).replace(/=+$/, '')}.f`
  localStorage.setItem('trk_perfil', JSON.stringify({ id: 3, nombre: 'Jurado Ana', rol: 'TRK_JURADO', permisos: { calificar: true } }))
  trk.get.mockImplementation(async (url) => {
    if (url === '/auth/yo') throw { status: 0, motivo: 'SIN_CONEXION' }
    throw { status: 0, motivo: 'SIN_CONEXION', message: 'Sin conexión con el servidor' }
  })
  setActivePinia(createPinia())
  mount(LoginView)
  await flushPromises()
  expect(push).toHaveBeenCalledWith('/jurado')
})

test('muestra el logo oficial del evento con el nombre accesible', async () => {
  const w = mount(LoginView)
  await flushPromises()
  const logo = w.get('[data-test="logo-login"]')
  expect(logo.attributes('src')).toContain('marca/logo-trikipeludos.webp')
  expect(logo.attributes('alt')).toContain('TrikiPeludos')
  expect(w.get('h1').text()).toContain('TRIKIPELUDOS')
})
