import { test, expect } from '@playwright/test'
import { entrarConPin, sinScrollHorizontal } from './utilidades'

const API = 'http://localhost:3021/api/trk/v1'

async function ponerEnPasarela(request, nombre) {
  const usuarios = (await (await request.get(`${API}/auth/usuarios-pin`)).json()).data
  const comentarista = usuarios.find((u) => u.nombre === 'Comentarista E2E')
  const { data } = await (await request.post(`${API}/auth/pin`, { data: { usuario_id: comentarista.id, pin: '222222' } })).json()
  const auth = { Authorization: `Bearer ${data.token}` }
  const cola = (await (await request.get(`${API}/participantes`, { headers: auth })).json()).data
  const p = cola.find((x) => x.mascota_nombre === nombre)
  await request.post(`${API}/pasarela/${p.id}`, { headers: auth })
}

const fila = (page, nombre) => page.locator('[data-test^="fila-"]', { hasText: nombre })

async function llenarFila(page, nombre, valor) {
  const celdas = fila(page, nombre).locator('input[inputmode="numeric"]')
  await celdas.first().waitFor()
  const n = await celdas.count()
  for (let i = 0; i < n; i++) await celdas.nth(i).fill(valor)
}

test('jurado anota en la matriz, ve total y puesto tentativo y envía la calificación final de la categoría (HU-8b)', async ({ page, request }) => {
  await entrarConPin(page, 'Jurado E2E 1', '333331')
  await ponerEnPasarela(request, 'Toby')
  await expect(page.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 3000 })
  await llenarFila(page, 'Toby', '5')
  await expect(fila(page, 'Toby').locator('[data-test^="estado-"]')).toHaveText('Guardado', { timeout: 5000 })

  await ponerEnPasarela(request, 'Kira')
  await expect(page.getByTestId('en-pasarela')).toContainText('Kira', { timeout: 3000 })
  await expect(page.locator('[data-test^="fila-"]').first()).toContainText('Kira')
  await llenarFila(page, 'Kira', '6')
  await expect(fila(page, 'Kira').locator('[data-test^="puesto-"]')).toHaveText('1')
  await expect(fila(page, 'Toby').locator('[data-test^="puesto-"]')).toHaveText('2')
  expect(await sinScrollHorizontal(page)).toBe(true)

  await expect(page.getByTestId('enviar-final')).toHaveText('Enviar calificación final (2)')
  await page.getByTestId('enviar-final').click()
  await expect(page.getByTestId('confirmacion')).toContainText('Kira')
  await page.getByTestId('confirmar-final').click()
  await expect(page.locator('[data-test^="final-"]')).toHaveCount(2, { timeout: 5000 })
  await expect(page.getByTestId('enviar-final')).toBeDisabled()
  expect(await sinScrollHorizontal(page)).toBe(true)
})

test('sin conexión el borrador espera en el dispositivo y se guarda al volver (HU-8b CA5)', async ({ page, context }) => {
  await entrarConPin(page, 'Jurado E2E 2', '333332')
  await expect(fila(page, 'Kira')).toBeVisible({ timeout: 5000 })
  await context.setOffline(true)
  await llenarFila(page, 'Kira', '7')
  await expect(fila(page, 'Kira').locator('[data-test^="estado-"]')).toHaveText('Sin conexión', { timeout: 5000 })
  await context.setOffline(false)
  await expect(fila(page, 'Kira').locator('[data-test^="estado-"]')).toHaveText('Guardado', { timeout: 15_000 })
  await page.reload()
  await expect(fila(page, 'Kira').locator('input[inputmode="numeric"]').first()).toHaveValue('7', { timeout: 5000 })
})
