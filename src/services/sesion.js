// Coordinación de la sesión entre pestañas y ante sesiones invalidadas.
export const CLAVE_TOKEN = 'trk_token'

// El token vive en localStorage compartido: si otra pestaña lo cambia (otro jurado entra o alguien sale),
// esta pestaña se recarga para no seguir actuando con la identidad anterior (I1).
export function vigilarTokenCompartido(recargar = () => window.location.reload()) {
  const alCambiar = (e) => {
    if (e.key === CLAVE_TOKEN || e.key === null) recargar()
  }
  window.addEventListener('storage', alCambiar)
  return () => window.removeEventListener('storage', alCambiar)
}
