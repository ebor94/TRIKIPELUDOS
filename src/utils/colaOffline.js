import { createStore, get, set, del, entries } from 'idb-keyval'

// Cola persistente de calificaciones no sincronizadas (HU-8 CA5). Sobrevive a recargas y cierres.
const almacen = createStore('trikipeludos', 'cola_calificaciones')
const clave = (juradoId, participanteId) => `${juradoId}:${participanteId}`

export async function encolar({ juradoId, participanteId, puntajes }) {
  const item = { juradoId, participanteId, puntajes, encoladaEn: Date.now() }
  await set(clave(juradoId, participanteId), item, almacen)
  return item
}

export const obtener = (juradoId, participanteId) => get(clave(juradoId, participanteId), almacen)

export async function listar(juradoId) {
  return (await entries(almacen)).map(([, v]) => v).filter((v) => v.juradoId === juradoId)
}

export const quitar = (juradoId, participanteId) => del(clave(juradoId, participanteId), almacen)
