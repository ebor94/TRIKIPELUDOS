// Imágenes oficiales del evento (public/marca). VITE_LOGO_URL permite reemplazar el logo sin recompilar código.
const base = import.meta.env.BASE_URL
export const LOGO = import.meta.env.VITE_LOGO_URL || `${base}marca/logo-trikipeludos.webp`
export const MASCOTAS = `${base}marca/mascotas.webp`
export const ALT_LOGO = 'TrikiPeludos — Concurso de disfraces para mascotas y familia'
