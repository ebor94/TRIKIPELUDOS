import { defineStore } from 'pinia'
import { trk } from '@/services/api'

export const useEventoStore = defineStore('evento', {
  state: () => ({ enPasarela: null, modoPantalla: 'PASARELA', categoriaPantalla: null, ranking: null, actualizadoEn: null }),
  actions: {
    aplicarEstado(estado) {
      this.enPasarela = estado.en_pasarela
      this.modoPantalla = estado.modo_pantalla
      this.categoriaPantalla = estado.categoria_pantalla
      this.ranking = estado.ranking || null
      this.actualizadoEn = Date.now()
    },
    async sincronizar() {
      const { data } = await trk.get('/evento/estado')
      this.aplicarEstado(data)
    },
    alCambioPasarela({ participante }) {
      this.enPasarela = participante
      this.actualizadoEn = Date.now()
    },
    alFotoNueva({ participante }) {
      if (this.enPasarela && participante && participante.id === this.enPasarela.id) {
        this.enPasarela = { ...this.enPasarela, foto_url: participante.foto_url }
      }
    }
  }
})
