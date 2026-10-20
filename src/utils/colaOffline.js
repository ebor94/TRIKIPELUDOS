import { createStore, get, set, del, entries } from 'idb-keyval'

// Cola persistente de calificaciones no sincronizadas (HU-8 CA5). Sobrevive a recargas y cierres.
const almacen = createStore('trikipeludos', 'cola_calificaciones')
const clave = (juradoId, participanteId) => `${juradoId}:${participanteId}`

// Marca de encolado estrictamente creciente: permite distinguir versiones aunque ocurran en el mismo ms.
let ultimaMarca = 0
const marca = () => (ultimaMarca = Math.max(Date.now(), ultimaMarca + 1))

export async function encolar({ juradoId, participanteId, puntajes }) {
  const item = { juradoId: String(juradoId), participanteId: String(participanteId), puntajes, encoladaEn: marca() }
  await set(clave(item.juradoId, item.participanteId), item, almacen)
  return item
}

export const obtener = (juradoId, participanteId) => get(clave(juradoId, participanteId), almacen)

export async function listar(juradoId) {
  return (await entries(almacen)).map(([, v]) => v).filter((v) => String(v.juradoId) === String(juradoId))
}

export const quitar = (juradoId, participanteId) => del(clave(juradoId, participanteId), almacen)
