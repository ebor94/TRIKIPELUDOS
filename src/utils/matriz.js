// Cálculos de la matriz del jurado (HU-8b). Los máximos vienen de la API (rúbrica sembrada), nunca de constantes.
export const vacio = (v) => v === null || v === undefined || v === ''

export function totalDe(valores = {}, criterios = []) {
  return criterios.reduce((s, c) => s + (vacio(valores[c.id]) ? 0 : Number(valores[c.id])), 0)
}

export const completa = (valores = {}, criterios = []) => criterios.length > 0 && criterios.every((c) => !vacio(valores[c.id]))

// CA4: orden por total descendente sobre las filas completas; los empatados comparten puesto y llevan "=".
// No aplica R3–R6 (eso es solo del ranking oficial).
export function puestosTentativos(filas = []) {
  const completas = filas.filter((f) => f.completa)
  const salida = {}
  for (const f of completas) {
    const mejores = completas.filter((g) => g.total > f.total).length
    const empatados = completas.filter((g) => g.total === f.total).length
    salida[f.id] = `${empatados > 1 ? '=' : ''}${mejores + 1}`
  }
  return salida
}

export function normalizarEntrada(texto, max) {
  const digitos = String(texto ?? '').replace(/\D/g, '')
  if (digitos === '') return null
  return Math.min(Number(digitos), max)
}

export const aLista = (valores = {}, criterios = []) =>
  criterios.map((c) => ({ criterio_id: c.id, puntaje: vacio(valores[c.id]) ? null : Number(valores[c.id]) }))

export const aMapa = (lista = []) => Object.fromEntries(lista.map((x) => [x.criterio_id, x.puntaje]))
