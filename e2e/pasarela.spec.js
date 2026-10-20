import { test, expect } from '@playwright/test'
import { nuevoContexto, entrarConPin, sinScrollHorizontal } from './utilidades'

test('comentarista llama a pasarela y 2 pantallas + el propio comentarista lo ven en < 2 s', async ({ browser }) => {
  const ctxComentarista = await nuevoContexto(browser)
  const ctxPantalla1 = await nuevoContexto(browser)
  const ctxPantalla2 = await nuevoContexto(browser)
  const ctxJurado = await nuevoContexto(browser)
  const comentarista = await ctxComentarista.newPage()
  const pantalla1 = await ctxPantalla1.newPage()
  const pantalla2 = await ctxPantalla2.newPage()
  const jurado = await ctxJurado.newPage()

  await entrarConPin(comentarista, 'Comentarista E2E', '222222')
  await expect(comentarista).toHaveURL(/comentarista/)
  expect(await sinScrollHorizontal(comentarista)).toBe(true)
  await pantalla1.goto('pantalla')
  await pantalla2.goto('pantalla')
  // No se asume pantalla vacía: otros archivos E2E pueden haber dejado una mascota en pasarela.
  await entrarConPin(jurado, 'Jurado E2E 3', '333333')
  await expect(pantalla1.locator('main')).toBeVisible()
  await expect(pantalla2.locator('main')).toBeVisible()

  await expect(comentarista.getByTestId('ficha')).toContainText('Toby')
  const inicio = Date.now()
  await comentarista.getByTestId('llamar').click()
  await Promise.all([
    expect(pantalla1.getByRole('heading', { name: 'Toby' })).toBeVisible({ timeout: 2000 }),
    expect(pantalla2.getByRole('heading', { name: 'Toby' })).toBeVisible({ timeout: 2000 }),
    expect(comentarista.getByTestId('llamar')).toHaveText(/En pasarela/, { timeout: 2000 }),
    expect(jurado.getByTestId('en-pasarela')).toContainText('Toby', { timeout: 2000 })
  ])
  const ms = Date.now() - inicio
  console.log(`latencia pasarela (3 clientes): ${ms} ms`)
  expect(ms).toBeLessThan(2000)

  await comentarista.getByTestId('siguiente').click()
  await comentarista.getByTestId('llamar').click()
  await expect(pantalla1.getByRole('heading', { name: 'Kira' })).toBeVisible({ timeout: 2000 })

  await Promise.all([ctxComentarista.close(), ctxPantalla1.close(), ctxPantalla2.close(), ctxJurado.close()])
})
