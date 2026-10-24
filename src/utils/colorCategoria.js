// Color de categoría (viene de la API como '#RRGGBB', puede ser null). Nunca se fijan aquí los colores reales.
const NEGRO = '#000000'
const BLANCO = '#FFFFFF'

export function normalizarColor(color) {
  if (typeof color !== 'string') return null
  const c = color.trim()
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : null
}

// Luminancia relativa WCAG 2.x.
function luminancia(hex) {
  const canal = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(normalizarColor(a)), luminancia(normalizarColor(b))].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// Negro o blanco, el que tenga mejor contraste sobre el color (empate: negro).
export function textoSobre(color) {
  const c = normalizarColor(color)
  if (!c) return null
  return contraste(c, NEGRO) >= contraste(c, BLANCO) ? NEGRO : BLANCO
}

// Relleno sólido (elegida / chip). Sin color: {} y queda el estilo de siempre.
export function estiloSolido(color) {
  const c = normalizarColor(color)
  return c ? { backgroundColor: c, color: textoSobre(c), borderColor: c } : {}
}

// Contorno con fondo translúcido (no elegida): el texto conserva el color de la vista.
export function estiloTenue(color) {
  const c = normalizarColor(color)
  return c ? { borderColor: c, backgroundColor: `${c}33` } : {}
}
