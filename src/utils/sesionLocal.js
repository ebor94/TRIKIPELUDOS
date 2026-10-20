// Utilidades de sesión local (sin red): lectura del payload del JWT guardado.

// Id del usuario dentro del token (el JWT de PIN y el de Mantix llevan `id`). null si no se puede leer.
export function idDelToken(token) {
  try {
    const parte = String(token).split('.')[1]
    if (!parte) return null
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.from(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    )
    const id = JSON.parse(json).id
    return id === undefined || id === null ? null : id
  } catch {
    return null
  }
}

// Perfil mínimo de la sesión, persistido junto al token para que una recarga sin conexión
// (iOS descarta pestañas, pull-to-refresh) no saque al jurado a /login (I5).
const CLAVE_PERFIL = 'trk_perfil'
const minimo = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, permisos: u.permisos || {} })

export const perfilStorage = {
  leer() {
    try {
      const crudo = localStorage.getItem(CLAVE_PERFIL)
      return crudo ? JSON.parse(crudo) : null
    } catch { return null }
  },
  guardar(usuario) {
    try {
      if (usuario) localStorage.setItem(CLAVE_PERFIL, JSON.stringify(minimo(usuario)))
      else localStorage.removeItem(CLAVE_PERFIL)
    } catch { /* almacenamiento no disponible */ }
  }
}
