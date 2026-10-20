import { test, expect } from 'vitest'
import { calcularRecorte45, dimensionesDestino } from '@/utils/imagen'

test('recorte 4:5 centrado de una foto horizontal', () => {
  expect(calcularRecorte45(4000, 3000)).toEqual({ sx: 800, sy: 0, sw: 2400, sh: 3000 })
})

test('recorte 4:5 centrado de una foto muy vertical', () => {
  expect(calcularRecorte45(1000, 2000)).toEqual({ sx: 0, sy: 375, sw: 1000, sh: 1250 })
})

test('una foto ya 4:5 no se recorta', () => {
  expect(calcularRecorte45(800, 1000)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 1000 })
})

test('lado mayor ≤ 1600 sin agrandar', () => {
  expect(dimensionesDestino(2400, 3000)).toEqual({ ancho: 1280, alto: 1600 })
  expect(dimensionesDestino(400, 500)).toEqual({ ancho: 400, alto: 500 })
})
