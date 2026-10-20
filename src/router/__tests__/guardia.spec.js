import { test, expect, vi } from 'vitest'

vi.mock('@/services/api', () => ({ api: {}, trk: {}, tokenStorage: { leer: () => null, guardar: () => {} } }))

import { decidirNavegacion, guardia } from '@/router'

const ruta = (meta = {}, padres = []) => ({ fullPath: '/x', meta, matched: [...padres.map((m) => ({ meta: m })), { meta }] })
const auth = (permisos, token = 't') => ({
  token,
  tiene: (a) => permisos[a] === true,
  rutaInicio: permisos.calificar ? '/jurado' : permisos.administrar ? '/admin' : '/login'
})

test('rutas públicas pasan sin sesión', () => {
  expect(decidirNavegacion(ruta({ publica: true }), auth({}, null))).toBe(true)
})

test('sin token → login con redirect', () => {
  expect(decidirNavegacion(ruta({ permiso: 'calificar' }), auth({}, null))).toEqual({ path: '/login', query: { redirect: '/x' } })
})

test('sin permiso → su pantalla de inicio', () => {
  expect(decidirNavegacion(ruta({ permiso: 'administrar' }), auth({ calificar: true }))).toEqual({ path: '/jurado' })
})

test('permiso heredado del padre', () => {
  expect(decidirNavegacion(ruta({}, [{ permiso: 'administrar' }]), auth({ calificar: true }))).toEqual({ path: '/jurado' })
  expect(decidirNavegacion(ruta({}, [{ permiso: 'administrar' }]), auth({ administrar: true }))).toBe(true)
})

test('I2: si el perfil responde 401 va a /login con motivo SESION_EXPIRADA', async () => {
  const a = { token: 't', usuario: null, cargarPerfil: async () => { a.token = null; throw { status: 401 } }, tiene: () => false, rutaInicio: '/login' }
  expect(await guardia(ruta({ permiso: 'calificar' }), a)).toEqual({ path: '/login', query: { redirect: '/x', motivo: 'SESION_EXPIRADA' } })
})
