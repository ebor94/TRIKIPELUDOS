import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => {
  const almacen = { token: null }
  return {
    api: { post: vi.fn() },
    trk: { post: vi.fn(), get: vi.fn() },
    tokenStorage: { leer: () => almacen.token, guardar: (t) => { almacen.token = t } }
  }
})

import { api, trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('loginPin guarda token y usuario', async () => {
  trk.post.mockResolvedValue({ data: { token: 't1', usuario: { id: 7, nombre: 'Jurado', rol: 'TRK_JURADO', permisos: { calificar: true } } } })
  const auth = useAuthStore()
  await auth.loginPin(7, '123456')
  expect(trk.post).toHaveBeenCalledWith('/auth/pin', { usuario_id: 7, pin: '123456' })
  expect(auth.autenticado).toBe(true)
  expect(auth.tiene('calificar')).toBe(true)
  expect(auth.rutaInicio).toBe('/jurado')
})

test('loginAdmin usa el login de Mantix y exige permiso administrar', async () => {
  api.post.mockResolvedValue({ data: { token: 'tm' } })
  trk.get.mockResolvedValue({ data: { id: 1, nombre: 'Admin', rol: 'Administrador', permisos: { administrar: true } } })
  const auth = useAuthStore()
  await auth.loginAdmin('a@b.co', 'x')
  expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.co', password: 'x' })
  expect(auth.rutaInicio).toBe('/admin')
})

test('loginAdmin rechaza usuarios de Mantix sin acceso TRK y cierra sesión', async () => {
  api.post.mockResolvedValue({ data: { token: 'tm' } })
  trk.get.mockResolvedValue({ data: { id: 2, nombre: 'Otro', rol: 'ASESOR', permisos: {} } })
  const auth = useAuthStore()
  await expect(auth.loginAdmin('a@b.co', 'x')).rejects.toMatchObject({ motivo: 'SIN_PERMISO' })
  expect(auth.token).toBeNull()
})

test('rutaInicio por permiso', () => {
  const auth = useAuthStore()
  auth.usuario = { permisos: { cabina: true } }
  expect(auth.rutaInicio).toBe('/cabina')
  auth.usuario = { permisos: { pasarela: true } }
  expect(auth.rutaInicio).toBe('/comentarista')
  auth.usuario = null
  expect(auth.rutaInicio).toBe('/login')
})
