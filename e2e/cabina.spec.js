import { test, expect } from '@playwright/test'
import { entrarConPin, imagenDePrueba, sinScrollHorizontal } from './utilidades'

test('cabina: buscar sin tildes, tomar foto y dejar PRESENTE a 360 px', async ({ page }) => {
  await entrarConPin(page, 'Cabina E2E', '111111')
  await expect(page).toHaveURL(/cabina/)
  expect(await sinScrollHorizontal(page)).toBe(true)

  await page.getByTestId('buscar').fill('misifu')
  await page.getByRole('button', { name: /Misifú/ }).click()
  await expect(page.getByText('Inscrito').first()).toBeVisible()

  await page.getByTestId('input-camara').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: await imagenDePrueba(page) })
  await expect(page.getByTestId('repetir')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Ficha del participante').getByText('Presente')).toBeVisible()
  await expect(page.getByLabel('Ficha del participante').locator('img')).toHaveAttribute('src', /\/uploads\/trk\/fotos\/.+\.jpg/)
  expect(await sinScrollHorizontal(page)).toBe(true)
})
