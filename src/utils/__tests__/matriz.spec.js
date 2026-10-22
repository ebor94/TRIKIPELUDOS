import { test, expect } from 'vitest'
import { totalDe, completa, puestosTentativos, normalizarEntrada, aLista, aMapa } from '@/utils/matriz'

const criterios = [{ id: 1 }, { id: 2 }]

test('total suma solo lo escrito; completa exige todas las casillas', () => {
  expect(totalDe({ 1: 5, 2: null }, criterios)).toBe(5)
  expect(totalDe({}, criterios)).toBe(0)
  expect(completa({ 1: 5, 2: null }, criterios)).toBe(false)
  expect(completa({ 1: 0, 2: 0 }, criterios)).toBe(true)
  expect(completa({}, [])).toBe(false)
})

test('puesto tentativo: total descendente sobre filas completas y empates con "=" (CA4)', () => {
  const filas = [
    { id: 'a', total: 90, completa: true },
    { id: 'b', total: 85, completa: true },
    { id: 'c', total: 85, completa: true },
    { id: 'd', total: 70, completa: true },
    { id: 'e', total: 99, completa: false }
  ]
  expect(puestosTentativos(filas)).toEqual({ a: '1', b: '=2', c: '=2', d: '4' })
})

test('entrada numérica: solo dígitos, tope en el máximo, vacío = null', () => {
  expect(normalizarEntrada('12', 9)).toBe(9)
  expect(normalizarEntrada('a3', 9)).toBe(3)
  expect(normalizarEntrada('', 9)).toBeNull()
  expect(normalizarEntrada('-', 9)).toBeNull()
  expect(normalizarEntrada('0', 9)).toBe(0)
})

test('conversiones lista ↔ mapa para la cola y el API', () => {
  expect(aLista({ 1: 4 }, criterios)).toEqual([{ criterio_id: 1, puntaje: 4 }, { criterio_id: 2, puntaje: null }])
  expect(aMapa([{ criterio_id: 1, puntaje: 4 }, { criterio_id: 2, puntaje: null }])).toEqual({ 1: 4, 2: null })
})
