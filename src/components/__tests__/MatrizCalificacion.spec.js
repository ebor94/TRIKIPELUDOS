import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MatrizCalificacion from '@/components/MatrizCalificacion.vue'

// Máximos ficticios: los reales vienen de la API.
const criterios = [{ id: 1, nombre: 'Creatividad', puntaje_max: 9 }, { id: 2, nombre: 'Seguridad', puntaje_max: 8 }]
const fila = (id, valores = {}, extra = {}) => ({ id, participante: { id, mascota_nombre: id.toUpperCase() }, valores, total: 0, completa: false, esFinal: false, ...extra })
const montar = (props) => mount(MatrizCalificacion, { props: { criterios, filas: [fila('t')], ...props } })

test('encabezados con el máximo de cada criterio, Total y Puesto; nombre en columna fija y scroll propio (CA3)', () => {
  const w = montar()
  expect(w.get('[data-test="criterio-1"]').text()).toContain('Creatividad')
  expect(w.get('[data-test="criterio-1"]').text()).toContain('/ 9')
  expect(w.get('thead').text()).toContain('Total')
  expect(w.get('thead').text()).toContain('Puesto')
  expect(w.get('[data-test="matriz"]').classes()).toContain('overflow-x-auto')
  expect(w.get('[data-test="fila-t"] th').classes()).toEqual(expect.arrayContaining(['sticky', 'left-0']))
})

test('casillas numéricas de 44 px: solo dígitos, tope en el máximo y vacío = null (CA4)', async () => {
  const w = montar()
  const celda = w.get('[data-test="celda-t-1"]')
  expect(celda.attributes('inputmode')).toBe('numeric')
  expect(celda.classes()).toContain('h-11')
  await celda.setValue('12')
  expect(w.emitted('cambiar').at(-1)[0]).toEqual({ participanteId: 't', criterioId: 1, valor: 9 })
  expect(celda.element.value).toBe('9')
  await celda.setValue('a3')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBe(3)
  await celda.setValue('')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBeNull()
})

test('total, puesto con "=" y "—" sin puesto; resalta la mascota en pasarela', () => {
  const w = montar({
    filas: [fila('t', { 1: 9, 2: 8 }, { total: 17, completa: true }), fila('k', { 1: 1 }, { total: 1 })],
    puestos: { t: '=1' },
    enPasarelaId: 't'
  })
  expect(w.get('[data-test="total-t"]').text()).toBe('17')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('=1')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('—')
  expect(w.get('[data-test="fila-t"]').classes()).toContain('bg-calabaza-50')
})

test('fila final: ✓ Enviada y casillas deshabilitadas (CA7)', () => {
  const w = montar({ filas: [fila('k', { 1: 9, 2: 8 }, { esFinal: true, total: 17, completa: true })] })
  expect(w.get('[data-test="final-k"]').text()).toContain('✓')
  expect(w.get('[data-test="celda-k-1"]').attributes('disabled')).toBeDefined()
})

test('indicador por fila Guardado / Guardando… / Sin conexión (CA5)', () => {
  const w = montar({ filas: [fila('a'), fila('b'), fila('c')], estados: { a: 'GUARDADO', b: 'GUARDANDO', c: 'SIN_CONEXION' } })
  expect(w.get('[data-test="estado-a"]').text()).toBe('Guardado')
  expect(w.get('[data-test="estado-b"]').text()).toBe('Guardando…')
  expect(w.get('[data-test="estado-c"]').text()).toBe('Sin conexión')
})

test('botones − y + de 44 px junto a cada casilla: suman/restan 1 dentro de 0..máximo (vacío cuenta como 0)', async () => {
  const w = montar({ filas: [fila('t', { 1: 8, 2: null })] })
  const mas = w.get('[data-test="mas-t-1"]')
  const menos = w.get('[data-test="menos-t-2"]')
  expect(mas.classes()).toEqual(expect.arrayContaining(['h-11', 'w-11']))
  await mas.trigger('click')
  expect(w.emitted('cambiar').at(-1)[0]).toEqual({ participanteId: 't', criterioId: 1, valor: 9 })
  await w.setProps({ filas: [fila('t', { 1: 9, 2: null })] })
  await w.get('[data-test="mas-t-1"]').trigger('click')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBe(9) // tope en el máximo
  await menos.trigger('click')
  expect(w.emitted('cambiar').at(-1)[0]).toEqual({ participanteId: 't', criterioId: 2, valor: 0 })
  await w.get('[data-test="mas-t-2"]').trigger('click')
  expect(w.emitted('cambiar').at(-1)[0].valor).toBe(1)
})

test('los botones − y + se deshabilitan en filas finales o con la matriz deshabilitada', () => {
  const w = montar({ filas: [fila('t', {}, { esFinal: true }), fila('k')], deshabilitada: false })
  expect(w.get('[data-test="mas-t-1"]').attributes('disabled')).toBeDefined()
  expect(w.get('[data-test="mas-k-1"]').attributes('disabled')).toBeUndefined()
  const w2 = montar({ deshabilitada: true })
  expect(w2.get('[data-test="menos-t-1"]').attributes('disabled')).toBeDefined()
})

test('tocar la foto de una fila pide verla ampliada', async () => {
  const w = montar()
  await w.get('[data-test="ver-foto-t"]').trigger('click')
  expect(w.emitted('ver-foto')[0][0]).toMatchObject({ id: 't', mascota_nombre: 'T' })
})
