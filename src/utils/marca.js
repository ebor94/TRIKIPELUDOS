// Imágenes oficiales del evento (public/marca). VITE_LOGO_URL permite reemplazar el logo sin recompilar código.
const base = import.meta.env.BASE_URL
export const LOGO = import.meta.env.VITE_LOGO_URL || `${base}marca/logo-trikipeludos.webp`
export const MASCOTAS = `${base}marca/mascotas.webp`
export const ALT_LOGO = 'TrikiPeludos — Concurso de disfraces para mascotas y familia'
export const FONDO_PANTALLA = `${base}marca/fondo-pantalla.webp`
export const PATROCINADORES = `${base}marca/patrocinadores.webp`
export const ALT_PATROCINADORES = 'Más Vida para ti · Los Olivos, un homenaje al amor'
export const TROFEO = { 1: `${base}marca/trofeo-1.webp`, 2: `${base}marca/trofeo-2.webp`, 3: `${base}marca/trofeo-3.webp` }
export const LOGO_TEXTO = `${base}marca/logo-texto.webp`
