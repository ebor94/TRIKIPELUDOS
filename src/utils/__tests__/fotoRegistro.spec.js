import { test, expect } from 'vitest'
import { urlFotoRegistro } from '@/utils/fotoRegistro'

test('enlace de Drive /file/d/ID/view → imagen visible (miniatura de Drive)', () => {
  expect(urlFotoRegistro('https://drive.google.com/file/d/1dj1ngLfuQJnAU8G1YS5EG_aF2T4pjTR3/view?usp=drive_link'))
    .toBe('https://drive.google.com/thumbnail?id=1dj1ngLfuQJnAU8G1YS5EG_aF2T4pjTR3&sz=w1000')
})

test('otras formas de Drive (open?id= y uc?id=)', () => {
  expect(urlFotoRegistro('https://drive.google.com/open?id=ABC_123-x')).toBe('https://drive.google.com/thumbnail?id=ABC_123-x&sz=w1000')
  expect(urlFotoRegistro('https://drive.google.com/uc?export=view&id=XYZ')).toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w1000')
})

test('URL de imagen normal se usa tal cual; vacío o texto → null', () => {
  expect(urlFotoRegistro('https://x.com/y.jpg')).toBe('https://x.com/y.jpg')
  expect(urlFotoRegistro('')).toBeNull()
  expect(urlFotoRegistro(null)).toBeNull()
  expect(urlFotoRegistro('pendiente')).toBeNull()
})
