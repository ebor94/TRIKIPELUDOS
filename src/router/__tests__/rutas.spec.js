import { test, expect } from 'vitest'
import { routes } from '@/router'

test('v2.1: el jurado solo tiene /jurado (la matriz); /jurado/calificar/:id se retiró', () => {
  const rutas = routes.map((r) => r.path)
  expect(rutas).toContain('/jurado')
  expect(rutas).not.toContain('/jurado/calificar/:id')
})
