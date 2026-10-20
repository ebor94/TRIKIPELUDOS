import { test, expect, vi } from 'vitest'
import { vigilarTokenCompartido } from '@/services/sesion'

test('I1: si otra pestaña cambia el token, esta pestaña se recarga', () => {
  const recargar = vi.fn()
  const dejar = vigilarTokenCompartido(recargar)
  window.dispatchEvent(new StorageEvent('storage', { key: 'otra_clave', newValue: 'x' }))
  expect(recargar).not.toHaveBeenCalled()
  window.dispatchEvent(new StorageEvent('storage', { key: 'trk_token', oldValue: 'a', newValue: 'b' }))
  expect(recargar).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
  expect(recargar).toHaveBeenCalledTimes(2)
  dejar()
  window.dispatchEvent(new StorageEvent('storage', { key: 'trk_token', newValue: 'c' }))
  expect(recargar).toHaveBeenCalledTimes(2)
})

test('I2: sesión expirada → cierra sesión, va a /login con motivo y conserva la cola de IndexedDB', async () => {
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const { manejarSesionExpirada } = await import('@/services/sesion')
  const cola = await import('@/utils/colaOffline')
  await cola.encolar({ juradoId: 7, participanteId: 'p1', puntajes: [] })
  const orden = []
  const auth = { token: 't', logout: vi.fn(() => orden.push('logout')) }
  const calificacion = { reiniciar: vi.fn(() => orden.push('reiniciar')) }
  const router = { currentRoute: { value: { path: '/jurado/calificar/p1', fullPath: '/jurado/calificar/p1' } }, replace: vi.fn() }
  manejarSesionExpirada({ auth, calificacion, router })
  expect(orden).toEqual(['reiniciar', 'logout'])
  expect(router.replace).toHaveBeenCalledWith({ path: '/login', query: { motivo: 'SESION_EXPIRADA', redirect: '/jurado/calificar/p1' } })
  expect(await cola.listar(7)).toHaveLength(1)
})

test('I2: si ya no hay sesión (otro 401 simultáneo) no hace nada', async () => {
  const { manejarSesionExpirada } = await import('@/services/sesion')
  const auth = { token: null, logout: vi.fn() }
  const router = { currentRoute: { value: { path: '/jurado', fullPath: '/jurado' } }, replace: vi.fn() }
  manejarSesionExpirada({ auth, calificacion: { reiniciar: vi.fn() }, router })
  expect(auth.logout).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})
