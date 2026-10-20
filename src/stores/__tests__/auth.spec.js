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

const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwtDe = (id) => `h.${b64url({ id, scope: 'trk' })}.f`
const JURADO = { id: 7, nombre: 'Jurado', rol: 'TRK_JURADO', permisos: { calificar: true } }

describe('I5: perfil persistido para recargas sin conexión', () => {
  beforeEach(() => localStorage.clear())

  test('al entrar guarda el perfil mínimo y al salir lo borra', async () => {
    trk.post.mockResolvedValue({ data: { token: jwtDe(7), usuario: { ...JURADO, extra: 'x' } } })
    const auth = useAuthStore()
    await auth.loginPin(7, '123456')
    expect(JSON.parse(localStorage.getItem('trk_perfil'))).toEqual(JURADO)
    auth.logout()
    expect(localStorage.getItem('trk_perfil')).toBeNull()
  })

  test('sin conexión (status 0) cargarPerfil usa el perfil guardado del mismo usuario del token', async () => {
    localStorage.setItem('trk_perfil', JSON.stringify(JURADO))
    const auth = useAuthStore()
    auth.token = jwtDe(7)
    trk.get.mockRejectedValue({ status: 0, motivo: 'SIN_CONEXION' })
    await expect(auth.cargarPerfil()).resolves.toEqual(JURADO)
    expect(auth.tiene('calificar')).toBe(true)
    expect(auth.token).toBe(jwtDe(7))
  })

  test('sin conexión no usa un perfil guardado de otro usuario', async () => {
    localStorage.setItem('trk_perfil', JSON.stringify(JURADO))
    const auth = useAuthStore()
    auth.token = jwtDe(8)
    trk.get.mockRejectedValue({ status: 0 })
    await expect(auth.cargarPerfil()).rejects.toMatchObject({ status: 0 })
    expect(auth.usuario).toBeNull()
  })

  test('un 401 cierra sesión y borra el perfil guardado; un 500 no usa la caché', async () => {
    localStorage.setItem('trk_perfil', JSON.stringify(JURADO))
    const auth = useAuthStore()
    auth.token = jwtDe(7)
    trk.get.mockRejectedValueOnce({ status: 500 })
    await expect(auth.cargarPerfil()).rejects.toMatchObject({ status: 500 })
    expect(auth.usuario).toBeNull()
    trk.get.mockRejectedValueOnce({ status: 401 })
    await expect(auth.cargarPerfil()).rejects.toMatchObject({ status: 401 })
    expect(auth.token).toBeNull()
    expect(localStorage.getItem('trk_perfil')).toBeNull()
  })

  test('cargarPerfil exitoso actualiza el perfil guardado', async () => {
    const auth = useAuthStore()
    auth.token = jwtDe(7)
    trk.get.mockResolvedValue({ data: JURADO })
    await auth.cargarPerfil()
    expect(JSON.parse(localStorage.getItem('trk_perfil'))).toEqual(JURADO)
  })
})
