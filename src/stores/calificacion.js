import { defineStore } from 'pinia'
import { trk, tokenStorage } from '@/services/api'
import * as cola from '@/utils/colaOffline'
import { useAuthStore } from '@/stores/auth'
import { idDelToken } from '@/utils/sesionLocal'
import { mensajeDeError } from '@/utils/errores'

// Borradores de la matriz del jurado (HU-8b): una entrada por jurado+participante en IndexedDB, última escritura gana.
export const ESPERA_AUTOGUARDADO_MS = 700

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

// Temporizadores de autoguardado por fila (clave jurado:participante).
const temporizadores = new Map()
const cancelarTemporizador = (clave) => {
  clearTimeout(temporizadores.get(clave))
  temporizadores.delete(clave)
}

// La sesión vale para un jurado solo si coincide el usuario de esta pestaña Y el id dentro del token que
// realmente se enviará (localStorage es compartido entre pestañas: otra pudo entrar como otro jurado).
const esSesionDe = (juradoId) =>
  String(useAuthStore().usuario?.id) === String(juradoId) && String(idDelToken(tokenStorage.leer())) === String(juradoId)

const errorLocal = (motivo, message) => Object.assign(new Error(message), { status: 0, motivo, errors: [] })
const errorSesion = () =>
  errorLocal('SESION_CAMBIADA', 'La sesión de esta pestaña cambió de jurado. Vuelve a entrar con tu usuario antes de enviar la calificación final.')

// Generación de sesión: reiniciar() la incrementa y el trabajo iniciado antes ya no toca el estado ni programa envíos.
let generacion = 0
// Escrituras locales en curso (encolar + programar el autoguardado): finalizar las espera antes de leer IndexedDB.
const escrituras = new Set()
const registrarEscritura = (trabajo) => {
  escrituras.add(trabajo)
  const fin = () => escrituras.delete(trabajo)
  trabajo.then(fin, fin)
  return trabajo
}
const esperarEscrituras = async () => {
  while (escrituras.size) await Promise.allSettled([...escrituras])
}

export const useCalificacionStore = defineStore('calificacion', {
  // estados: participanteId → 'GUARDANDO' | 'GUARDADO' | 'SIN_CONEXION' | 'ERROR' (indicador por fila, CA5).
  state: () => ({ pendientes: {}, rechazadas: {}, estados: {}, sincronizando: false }),
  actions: {
    reiniciar() {
      generacion++
      for (const clave of [...temporizadores.keys()]) cancelarTemporizador(clave)
      this.pendientes = {}
      this.rechazadas = {}
      this.estados = {}
    },
    marcar(participanteId, estado) {
      this.estados = { ...this.estados, [String(participanteId)]: estado }
    },
    async cargarPendientes(juradoId) {
      const items = await cola.listar(juradoId)
      // Fusión sin esperas intermedias: lo anotado en memoria durante la lectura (más nuevo o ausente en ella) se conserva.
      const actuales = this.pendientes
      const fusion = {}
      for (const i of items) fusion[i.participanteId] = i
      for (const [pid, previo] of Object.entries(actuales)) {
        if (String(previo.juradoId) !== String(juradoId)) continue
        if (!fusion[pid] || (previo.encoladaEn || 0) > (fusion[pid].encoladaEn || 0)) fusion[pid] = previo
      }
      this.pendientes = fusion
    },
    // Autoguardado: la fila queda en IndexedDB al instante y se envía una sola vez cuando el jurado hace una pausa.
    anotar(juradoId, participanteId, puntajes, esperaMs = ESPERA_AUTOGUARDADO_MS) {
      const clave = `${juradoId}:${participanteId}`
      const gen = generacion
      this.marcar(participanteId, 'GUARDANDO')
      this.quitarRechazo(participanteId)
      cancelarTemporizador(clave)
      return registrarEscritura((async () => {
        const item = await cola.encolar({ juradoId, participanteId, puntajes })
        if (gen !== generacion) return item
        this.pendientes = { ...this.pendientes, [item.participanteId]: item }
        cancelarTemporizador(clave)
        temporizadores.set(clave, setTimeout(() => {
          temporizadores.delete(clave)
          this.intentar(juradoId, participanteId).catch(() => {})
        }, esperaMs))
        return item
      })())
    },
    async guardarBorrador(juradoId, participanteId, puntajes) {
      const gen = generacion
      cancelarTemporizador(`${juradoId}:${participanteId}`)
      this.marcar(participanteId, 'GUARDANDO')
      this.quitarRechazo(participanteId)
      const item = await registrarEscritura(cola.encolar({ juradoId, participanteId, puntajes }))
      if (gen !== generacion) return { estado: 'PENDIENTE' }
      this.pendientes = { ...this.pendientes, [item.participanteId]: item }
      return this.intentar(juradoId, participanteId)
    },
    intentar(juradoId, participanteId) {
      return enSerie(`${juradoId}:${participanteId}`, () => this._intentar(juradoId, participanteId))
    },
    async _intentar(juradoId, participanteId) {
      if (!esSesionDe(juradoId)) {
        // La fila sigue en cola (como un 401): se reintenta cuando vuelva la sesión del jurado.
        this.marcar(participanteId, 'SIN_CONEXION')
        return { estado: 'PENDIENTE' }
      }
      const item = await cola.obtener(juradoId, participanteId)
      if (!item) {
        this.olvidar(participanteId)
        return { estado: 'GUARDADO' }
      }
      let resultado
      try {
        const { data } = await trk.put(`/borradores/${participanteId}`, { puntajes: item.puntajes })
        resultado = { estado: 'GUARDADO', borrador: data }
        this.quitarRechazo(participanteId)
      } catch (e) {
        if (!definitivo(e)) {
          this.marcar(participanteId, 'SIN_CONEXION')
          return { estado: 'PENDIENTE' }
        }
        resultado = { estado: 'RECHAZADA', error: e }
      }
      // Solo se quita si la entrada sigue siendo la que se envió (pudo llegar una más nueva).
      if (await cola.quitarSiVersion(juradoId, participanteId, item.encoladaEn)) {
        this.olvidar(participanteId)
        if (resultado.estado === 'RECHAZADA') {
          const e = resultado.error
          this.rechazadas = { ...this.rechazadas, [String(participanteId)]: { motivo: e?.motivo || 'ERROR', message: mensajeDeError(e) } }
          this.marcar(participanteId, 'ERROR')
        } else {
          this.marcar(participanteId, 'GUARDADO')
        }
      }
      return resultado
    },
    quitarRechazo(participanteId) {
      if (!this.rechazadas[String(participanteId)]) return
      const resto = { ...this.rechazadas }
      delete resto[String(participanteId)]
      this.rechazadas = resto
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
    },
    // CA6: requiere conexión. Primero deja en el servidor lo que la categoría tenga en IndexedDB (la fuente de verdad,
    // no la memoria); si algo no se pudo guardar, no se envía nada (el servidor decide con sus borradores: todo o nada).
    async finalizar(juradoId, categoriaId, participanteIds) {
      // Guarda de sesión ANTES de todo: el POST iría con el token de esta pestaña (localStorage compartido).
      if (!esSesionDe(juradoId)) throw errorSesion()
      const ids = new Set(participanteIds.map(String))
      const deLaCategoria = (items) => items.filter((i) => ids.has(String(i.participanteId)))
      // Las anotaciones en curso terminan de escribirse (y programar su envío) antes de cancelar y leer la cola.
      await esperarEscrituras()
      for (const pid of ids) cancelarTemporizador(`${juradoId}:${pid}`)
      const enCola = deLaCategoria(await cola.listar(juradoId))
      const resultados = await Promise.all(enCola.map((i) => this.intentar(juradoId, i.participanteId)))
      const rechazo = resultados.find((r) => r.estado === 'RECHAZADA')
      if (rechazo) {
        const e = rechazo.error || {}
        throw Object.assign(new Error(mensajeDeError(e)), {
          status: e.status ?? 0,
          motivo: e.motivo || 'BORRADOR_RECHAZADO',
          errors: e.errors || []
        })
      }
      if (!esSesionDe(juradoId)) throw errorSesion()
      if (deLaCategoria(await cola.listar(juradoId)).length) {
        throw errorLocal('SIN_CONEXION', 'Hay puntajes sin guardar en el servidor. Revisa la conexión e inténtalo de nuevo.')
      }
      if ([...ids].some((pid) => this.rechazadas[pid])) {
        throw errorLocal('BORRADOR_RECHAZADO', 'Corrige las filas marcadas con error antes de enviar la calificación final.')
      }
      if (!esSesionDe(juradoId)) throw errorSesion()
      const { data } = await trk.post('/calificaciones/finalizar', { categoria_id: Number(categoriaId) })
      return data
    }
  }
})
