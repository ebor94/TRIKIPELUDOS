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
