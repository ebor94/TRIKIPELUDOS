import { defineStore } from 'pinia'
import { api, trk, tokenStorage } from '@/services/api'
import { idDelToken, perfilStorage } from '@/utils/sesionLocal'

// Sin respuesta del servidor (red caída, timeout): no hay status HTTP.
const sinConexion = (e) => !(e && Number.isInteger(e.status) && e.status > 0)

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: tokenStorage.leer(), usuario: null }),
  getters: {
    autenticado: (s) => Boolean(s.token && s.usuario),
    tiene: (s) => (accion) => Boolean(s.usuario && s.usuario.permisos && s.usuario.permisos[accion] === true),
    rutaInicio(s) {
      const p = (s.usuario && s.usuario.permisos) || {}
      if (p.administrar) return '/admin'
      if (p.cabina) return '/cabina'
      if (p.pasarela) return '/comentarista'
      if (p.calificar) return '/jurado'
      return '/login'
    }
  },
  actions: {
    fijarSesion(token, usuario) {
      this.token = token
      this.usuario = usuario
      tokenStorage.guardar(token)
      perfilStorage.guardar(usuario)
    },
    async loginPin(usuarioId, pin) {
      const { data } = await trk.post('/auth/pin', { usuario_id: usuarioId, pin })
      this.fijarSesion(data.token, data.usuario)
    },
    async loginAdmin(email, password) {
      const { data } = await api.post('/auth/login', { email, password })
      this.fijarSesion(data.token, null)
      await this.cargarPerfil()
      if (!this.tiene('administrar')) {
        this.logout()
        throw { status: 403, motivo: 'SIN_PERMISO', message: 'Tu usuario de Mantix no tiene acceso a TRIKIPELUDOS' }
      }
    },
    async cargarPerfil() {
      if (!this.token) return null
      try {
        const { data } = await trk.get('/auth/yo')
        this.usuario = data
        perfilStorage.guardar(data)
        return data
      } catch (e) {
        if (e && e.status === 401) this.logout()
        else if (sinConexion(e)) {
          // Sin conexión: se conserva la sesión con el perfil guardado si es del mismo usuario del token (I5).
          const cache = perfilStorage.leer()
          if (cache && String(cache.id) === String(idDelToken(this.token))) {
            this.usuario = cache
            return cache
          }
        }
        throw e
      }
    },
    logout() {
      this.token = null
      this.usuario = null
      tokenStorage.guardar(null)
      perfilStorage.guardar(null)
    }
  }
})
