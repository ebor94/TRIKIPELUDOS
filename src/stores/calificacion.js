import { defineStore } from 'pinia'
import { trk, tokenStorage } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useAuthStore } from '@/stores/auth'
import { idDelToken } from '@/utils/sesionLocal'

// Solo es definitivo un 4xx (distinto de 401/408/429) con status entero; todo lo demás se reintenta.
const definitivo = (e) => {
  const s = e?.status
  return Number.isInteger(s) && s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429
}

// Cadena de promesas por clave: el trabajo sobre un mismo participante nunca se intercala.
const cadenas = new Map()
const enSerie = (clave, tarea) => {
  const previa = cadenas.get(clave) || Promise.resolve()
  const actual = previa.then(tarea, tarea)
  const cola_ = actual.catch(() => {})
  cadenas.set(clave, cola_)
  cola_.then(() => cadenas.get(clave) === cola_ && cadenas.delete(clave))
  return actual
}

// La sesión vale para un jurado solo si coincide el usuario de esta pestaña Y el id dentro del token que
// realmente se enviará (localStorage es compartido entre pestañas: otra pudo entrar como otro jurado).
const esSesionDe = (juradoId) =>
  String(useAuthStore().usuario?.id) === String(juradoId) && String(idDelToken(tokenStorage.leer())) === String(juradoId)

export const useCalificacionStore = defineStore('calificacion', {
  state: () => ({ pendientes: {}, sincronizando: false }),
  actions: {
    reiniciar() {
      this.pendientes = {}
    },
    async cargarPendientes(juradoId) {
      const items = await cola.listar(juradoId)
      const nuevos = Object.fromEntries(items.map((i) => [i.participanteId, i]))
      // Conserva lo agregado en memoria durante la espera si sigue existiendo en IndexedDB.
      for (const [pid, previo] of Object.entries(this.pendientes)) {
        if (nuevos[pid] || String(previo.juradoId) !== String(juradoId)) continue
        const guardado = await cola.obtener(juradoId, pid)
        if (guardado) nuevos[pid] = guardado
      }
      this.pendientes = nuevos
    },
    async enviar(juradoId, participanteId, puntajes) {
      const item = await cola.encolar({ juradoId, participanteId, puntajes })
      this.pendientes = { ...this.pendientes, [item.participanteId]: item }
      return this.intentar(juradoId, participanteId)
    },
    intentar(juradoId, participanteId) {
      return enSerie(`${juradoId}:${participanteId}`, () => this._intentar(juradoId, participanteId))
    },
    async _intentar(juradoId, participanteId) {
      if (!esSesionDe(juradoId)) return { estado: 'PENDIENTE' }
      const item = await cola.obtener(juradoId, participanteId)
      if (!item) {
        this.olvidar(participanteId)
        return { estado: 'ENVIADA' }
      }
      let resultado
      try {
        const { data } = await trk.put(`/calificaciones/${participanteId}`, { puntajes: item.puntajes })
        resultado = { estado: 'ENVIADA', calificacion: data }
      } catch (e) {
        if (!definitivo(e)) return { estado: 'PENDIENTE' }
        resultado = { estado: 'RECHAZADA', error: e }
      }
      // Solo se quita si la entrada sigue siendo la que se envió (pudo llegar una más nueva).
      if (await cola.quitarSiVersion(juradoId, participanteId, item.encoladaEn)) this.olvidar(participanteId)
      return resultado
    },
    olvidar(participanteId) {
      const resto = { ...this.pendientes }
      delete resto[String(participanteId)]
      this.pendientes = resto
    },
    async sincronizar(juradoId) {
      if (this.sincronizando) return
      if (!esSesionDe(juradoId)) return
      this.sincronizando = true
      try {
        await this.cargarPendientes(juradoId)
        for (const participanteId of Object.keys(this.pendientes)) await this.intentar(juradoId, participanteId)
      } finally {
        this.sincronizando = false
      }
    },
    iniciarAutoSincronizacion(juradoId, intervaloMs = 10000) {
      const correr = () => {
        this.sincronizar(juradoId).catch(() => {})
      }
      window.addEventListener('online', correr)
      const temporizador = setInterval(correr, intervaloMs)
      return () => {
        window.removeEventListener('online', correr)
        clearInterval(temporizador)
      }
    }
  }
})
