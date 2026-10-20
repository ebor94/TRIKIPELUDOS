import { test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: {}, tokenStorage: { leer: () => 't', guardar: () => {}, borrar: () => {} } }))

import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import BarraSuperior from '@/components/BarraSuperior.vue'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

test('Salir reinicia la cola de calificaciones antes de cerrar sesión', async () => {
  const orden = []
  const auth = useAuthStore()
  auth.logout = vi.fn(() => orden.push('logout'))
  const cola = useCalificacionStore()
  cola.reiniciar = vi.fn(() => orden.push('reiniciar'))
  const w = mount(BarraSuperior, { props: { titulo: 'X' } })
  await w.get('button').trigger('click')
  expect(orden).toEqual(['reiniciar', 'logout'])
  expect(push).toHaveBeenCalledWith('/login')
})

import { flushPromises } from '@vue/test-utils'

test('I4: con calificaciones pendientes intenta sincronizar antes de salir y, si se envían, sale sin preguntar', async () => {
  window.confirm = vi.fn(() => true)
  const auth = useAuthStore()
  auth.usuario = { id: 7, permisos: { calificar: true } }
  auth.logout = vi.fn()
  const cola = useCalificacionStore()
  cola.pendientes = { p1: {} }
  cola.sincronizar = vi.fn(async () => { cola.pendientes = {} })
  const w = mount(BarraSuperior, { props: { titulo: 'X' } })
  await w.get('button').trigger('click')
  await flushPromises()
  expect(cola.sincronizar).toHaveBeenCalledWith(7)
  expect(window.confirm).not.toHaveBeenCalled()
  expect(auth.logout).toHaveBeenCalled()
  expect(push).toHaveBeenCalledWith('/login')
})

test('I4: si quedan pendientes pide confirmación explicando que solo se enviarán al volver a entrar aquí; cancelar no sale', async () => {
  window.confirm = vi.fn(() => false)
  const auth = useAuthStore()
  auth.usuario = { id: 7, permisos: { calificar: true } }
  auth.logout = vi.fn()
  const cola = useCalificacionStore()
  cola.pendientes = { p1: {}, p2: {} }
  cola.sincronizar = vi.fn(async () => {})
  const w = mount(BarraSuperior, { props: { titulo: 'X' } })
  await w.get('button').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/2 calificaciones sin enviar.*mismo jurado.*este dispositivo/s))
  expect(auth.logout).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()

  window.confirm = vi.fn(() => true)
  await w.get('button').trigger('click')
  await flushPromises()
  expect(auth.logout).toHaveBeenCalled()
  expect(push).toHaveBeenCalledWith('/login')
})

test('I4: un fallo al sincronizar no impide decidir salir', async () => {
  window.confirm = vi.fn(() => true)
  const auth = useAuthStore()
  auth.usuario = { id: 7, permisos: { calificar: true } }
  auth.logout = vi.fn()
  const cola = useCalificacionStore()
  cola.pendientes = { p1: {} }
  cola.sincronizar = vi.fn(async () => { throw new Error('IndexedDB') })
  const w = mount(BarraSuperior, { props: { titulo: 'X' } })
  await w.get('button').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(auth.logout).toHaveBeenCalled()
})
