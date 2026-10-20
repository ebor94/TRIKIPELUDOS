import { defineStore } from 'pinia'
import { api, trk, tokenStorage } from '@/services/api'

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
        return data
      } catch (e) {
        if (e.status === 401) this.logout()
        throw e
      }
    },
    logout() {
      this.token = null
      this.usuario = null
      tokenStorage.guardar(null)
    }
  }
})
