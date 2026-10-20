import { test, expect } from '@playwright/test'

// browser.newContext() no hereda `use` del proyecto: se pasan baseURL y emulación móvil explícitas.
export function nuevoContexto(browser) {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use
  return browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })
}

export async function entrarConPin(page, nombreUsuario, pin) {
  await page.goto('login')
  await page.getByRole('button', { name: new RegExp(nombreUsuario) }).click()
  await page.getByTestId('pin').fill(pin)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/login/)
}

// JPEG generado en el navegador (no se versionan binarios)
export async function imagenDePrueba(page, ancho = 1200, alto = 900) {
  const bytes = await page.evaluate(async ({ ancho, alto }) => {
    const c = document.createElement('canvas')
    c.width = ancho
    c.height = alto
    const g = c.getContext('2d')
    g.fillStyle = '#E8711A'
    g.fillRect(0, 0, ancho, alto)
    g.fillStyle = '#47206A'
    g.fillRect(ancho / 4, alto / 4, ancho / 2, alto / 2)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  }, { ancho, alto })
  return Buffer.from(bytes)
}

export const sinScrollHorizontal = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
