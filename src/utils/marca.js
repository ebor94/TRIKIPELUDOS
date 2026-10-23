// Imágenes oficiales del evento (src/assets/marca). Se importan para que Vite las publique con un hash de
// contenido en el nombre: al reemplazar una imagen cambia su URL y ninguna caché (Cloudflare, navegador,
// service worker) puede seguir sirviendo la versión anterior. VITE_LOGO_URL permite reemplazar el logo sin recompilar código.
import logo from '@/assets/marca/logo-trikipeludos.webp'
import mascotas from '@/assets/marca/mascotas.webp'
import fondoPantalla from '@/assets/marca/fondo-pantalla.webp'
import patrocinadores from '@/assets/marca/patrocinadores.webp'
import trofeo1 from '@/assets/marca/trofeo-1.webp'
import trofeo2 from '@/assets/marca/trofeo-2.webp'
import trofeo3 from '@/assets/marca/trofeo-3.webp'
import logoTexto from '@/assets/marca/logo-texto.webp'
import calabaza from '@/assets/marca/calabaza.webp'

export const LOGO = import.meta.env.VITE_LOGO_URL || logo
export const MASCOTAS = mascotas
export const ALT_LOGO = 'TrikiPeludos — Concurso de disfraces para mascotas y familia'
export const FONDO_PANTALLA = fondoPantalla
export const PATROCINADORES = patrocinadores
export const ALT_PATROCINADORES = 'Más Vida para ti · Los Olivos, un homenaje al amor'
export const TROFEO = { 1: trofeo1, 2: trofeo2, 3: trofeo3 }
export const LOGO_TEXTO = logoTexto
export const CALABAZA = calabaza
