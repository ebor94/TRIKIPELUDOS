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

// Borra solo si la versión almacenada sigue siendo `encoladaEn`; get + compare + delete en UNA transacción.
export const quitarSiVersion = (juradoId, participanteId, encoladaEn) =>
  almacen(
    'readwrite',
    (store) =>
      new Promise((resolve, reject) => {
        const k = clave(juradoId, participanteId)
        const lectura = store.get(k)
        lectura.onerror = () => reject(lectura.error)
        lectura.onsuccess = () => {
          const actual = lectura.result
          if (!actual || actual.encoladaEn !== encoladaEn) return resolve(false)
          const borrado = store.delete(k)
          borrado.onerror = () => reject(borrado.error)
          borrado.onsuccess = () => resolve(true)
        }
      })
  )
