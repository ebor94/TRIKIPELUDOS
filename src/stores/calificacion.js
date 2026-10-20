import { defineStore } from 'pinia'
import { trk } from '@/services/api'
import * as cola from '@/utils/colaOffline'

const reintentable = (e) => !e || e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500

export const useCalificacionStore = defineStore('calificacion', {
  state: () => ({ pendientes: {}, sincronizando: false }),
  actions: {
    async cargarPendientes(juradoId) {
      const items = await cola.listar(juradoId)
      this.pendientes = Object.fromEntries(items.map((i) => [i.participanteId, i]))
    },
    async enviar(juradoId, participanteId, puntajes) {
      const item = await cola.encolar({ juradoId, participanteId, puntajes })
      this.pendientes = { ...this.pendientes, [participanteId]: item }
      return this.intentar(juradoId, participanteId)
    },
    async intentar(juradoId, participanteId) {
      const item = await cola.obtener(juradoId, participanteId)
      if (!item) return { estado: 'ENVIADA' }
      try {
        const { data } = await trk.put(`/calificaciones/${participanteId}`, { puntajes: item.puntajes })
        await this.sacar(juradoId, participanteId)
        return { estado: 'ENVIADA', calificacion: data }
      } catch (e) {
        if (reintentable(e)) return { estado: 'PENDIENTE' }
        await this.sacar(juradoId, participanteId)
        return { estado: 'RECHAZADA', error: e }
      }
    },
    async sacar(juradoId, participanteId) {
      await cola.quitar(juradoId, participanteId)
      const resto = { ...this.pendientes }
      delete resto[participanteId]
      this.pendientes = resto
    },
    async sincronizar(juradoId) {
      if (this.sincronizando) return
      this.sincronizando = true
      try {
        await this.cargarPendientes(juradoId)
        for (const participanteId of Object.keys(this.pendientes)) await this.intentar(juradoId, participanteId)
      } finally {
        this.sincronizando = false
      }
    },
    iniciarAutoSincronizacion(juradoId, intervaloMs = 10000) {
      const correr = () => this.sincronizar(juradoId)
      window.addEventListener('online', correr)
      const temporizador = setInterval(correr, intervaloMs)
      return () => {
        window.removeEventListener('online', correr)
        clearInterval(temporizador)
      }
    }
  }
})
