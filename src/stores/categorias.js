import { defineStore } from 'pinia'
import { trk } from '@/services/api'

export const useCategoriasStore = defineStore('categorias', {
  state: () => ({ lista: [], cargada: false }),
  getters: {
    porId: (s) => (id) => s.lista.find((c) => c.id === Number(id)) || null,
    porCodigo: (s) => (codigo) => s.lista.find((c) => c.codigo === codigo) || null
  },
  actions: {
    async cargar(forzar = false) {
      if (this.cargada && !forzar) return this.lista
      this.lista = (await trk.get('/categorias')).data
      this.cargada = true
      return this.lista
    }
  }
})
