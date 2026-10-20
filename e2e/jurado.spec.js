import { test, expect } from '@playwright/test'
import { entrarConPin, sinScrollHorizontal } from './utilidades'

async function ponerEnPasarela(request, nombre) {
  const usuarios = (await (await request.get('http://localhost:3021/api/trk/v1/auth/usuarios-pin')).json()).data
  const comentarista = usuarios.find((u) => u.nombre === 'Comentarista E2E')
  const { data } = await (await request.post('http://localhost:3021/api/trk/v1/auth/pin', { data: { usuario_id: comentarista.id, pin: '222222' } })).json()
  const auth = { Authorization: `Bearer ${data.token}` }
  const cola = (await (await request.get('http://localhost:3021/api/trk/v1/participantes', { headers: auth })).json()).data
  const p = cola.find((x) => x.mascota_nombre === nombre)
  await request.post(`http://localhost:3021/api/trk/v1/pasarela/${p.id}`, { headers: auth })
}

async function llenarTodos(page) {
  const rangos = page.locator('input[type="range"]')
  await rangos.first().waitFor() // la rúbrica carga de forma asíncrona
  const n = await rangos.count()
  for (let i = 0; i < n; i++) await rangos.nth(i).fill('5')
}

test('jurado califica la mascota en pasarela y la calificación queda bloqueada', async ({ page, request }) => {
  await entrarConPin(page, 'Jurado E2E 1', '333331')
  await ponerEnPasarela(request, 'Toby')
  await expect(page.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 3000 })
  expect(await sinScrollHorizontal(page)).toBe(true)
  await page.getByTestId('calificar-en-pasarela').click()
  await llenarTodos(page)
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('enviar').click()
  await expect(page.getByText('Calificación enviada')).toBeVisible()
  expect(await sinScrollHorizontal(page)).toBe(true)
})

test('sin conexión la calificación queda pendiente y se sincroniza al volver (HU-8 CA5)', async ({ page, context, request }) => {
  await entrarConPin(page, 'Jurado E2E 2', '333332')
  await ponerEnPasarela(request, 'Kira')
  await expect(page.getByTestId('en-pasarela')).toContainText('Kira', { timeout: 3000 })
  await page.getByTestId('calificar-en-pasarela').click()
  await llenarTodos(page)
  await context.setOffline(true)
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('enviar').click()
  await expect(page.getByText('Pendiente de sincronizar')).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: '◀ Volver' }).click()
  await expect(page.locator('[data-test^="insignia-"]', { hasText: 'Calificada' })).toHaveCount(1, { timeout: 15_000 })
})
