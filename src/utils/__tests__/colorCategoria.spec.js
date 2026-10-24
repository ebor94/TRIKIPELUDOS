import { test, expect } from 'vitest'
import { normalizarColor, contraste, textoSobre, estiloSolido, estiloTenue } from '@/utils/colorCategoria'

test('normaliza #RRGGBB (mayúsculas) y descarta valores inválidos o nulos', () => {
  expect(normalizarColor('#92d050')).toBe('#92D050')
  expect(normalizarColor('  #FF9900 ')).toBe('#FF9900')
  for (const malo of [null, undefined, '', 'rojo', '#FFF', '#GG0000', 123]) expect(normalizarColor(malo)).toBeNull()
})

test('contraste WCAG entre blanco y negro es 21:1', () => {
  expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
  expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
})

test('texto oscuro sobre amarillo, verde, cian y naranja', () => {
  for (const c of ['#FFFF00', '#92D050', '#00B0F0', '#FF9900']) expect(textoSobre(c)).toBe('#000000')
})

test('sobre rojo elige el texto con mejor contraste y llega a 4.5:1', () => {
  const texto = textoSobre('#FF0000')
  const otro = texto === '#000000' ? '#FFFFFF' : '#000000'
  expect(contraste('#FF0000', texto)).toBeGreaterThanOrEqual(4.5)
  expect(contraste('#FF0000', texto)).toBeGreaterThan(contraste('#FF0000', otro))
})

test('texto blanco sobre colores oscuros', () => {
  expect(textoSobre('#1F1F7A')).toBe('#FFFFFF')
})

test('sin color: textoSobre null y estilos vacíos (se usa el estilo actual)', () => {
  expect(textoSobre(null)).toBeNull()
  expect(estiloSolido(null)).toEqual({})
  expect(estiloTenue('nada')).toEqual({})
})

test('estilo sólido: fondo del color, texto legible y borde del mismo color', () => {
  expect(estiloSolido('#ff0000')).toEqual({ backgroundColor: '#FF0000', color: textoSobre('#FF0000'), borderColor: '#FF0000' })
})

test('estilo tenue: borde del color y fondo translúcido', () => {
  expect(estiloTenue('#00B0F0')).toEqual({ borderColor: '#00B0F0', backgroundColor: '#00B0F033' })
})
