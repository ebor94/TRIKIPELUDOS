import { test, expect, vi, beforeEach } from 'vitest'
import { trk, api, alSesionExpirada, tokenStorage } from '@/services/api'

const responder = (status, data = {}) => (config) => Promise.reject({ config, response: { status, data, headers: {}, config } })

let manejador
beforeEach(() => {
  localStorage.clear()
  manejador = vi.fn()
  alSesionExpirada(manejador)
})

test('I2: un 401 de una llamada TRK con el token vigente avisa que la sesión expiró', async () => {
  tokenStorage.guardar('tok-A')
  await expect(trk.get('/calificaciones/mias', { adapter: responder(401, { motivo: 'NO_AUTENTICADO', message: 'x' }) }))
    .rejects.toMatchObject({ status: 401, motivo: 'NO_AUTENTICADO' })
  expect(manejador).toHaveBeenCalledTimes(1)
})

test('I2: los 401 de login/PIN (credenciales malas) no cierran sesión', async () => {
  tokenStorage.guardar('tok-A')
  await expect(trk.post('/auth/pin', {}, { adapter: responder(401) })).rejects.toMatchObject({ status: 401 })
  await expect(api.post('/auth/login', {}, { adapter: responder(401) })).rejects.toMatchObject({ status: 401 })
  expect(manejador).not.toHaveBeenCalled()
})

test('I2: un 401 de una petición hecha con otro token (ya reemplazado) no cierra la sesión nueva', async () => {
  tokenStorage.guardar('tok-A')
  const adapter = (config) => {
    tokenStorage.guardar('tok-B') // otra sesión entró mientras la petición viajaba
    return responder(401)(config)
  }
  await expect(trk.get('/participantes', { adapter })).rejects.toMatchObject({ status: 401 })
  expect(manejador).not.toHaveBeenCalled()
})

test('I2: otros errores no avisan', async () => {
  tokenStorage.guardar('tok-A')
  await expect(trk.get('/participantes', { adapter: responder(500) })).rejects.toMatchObject({ status: 500 })
  await expect(trk.get('/participantes', { adapter: responder(403) })).rejects.toMatchObject({ status: 403 })
  expect(manejador).not.toHaveBeenCalled()
})
