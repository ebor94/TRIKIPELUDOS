// Coordinación de la sesión entre pestañas y ante sesiones invalidadas.
import { CLAVE_TOKEN, alSesionExpirada } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'

export const MOTIVO_SESION_EXPIRADA = 'SESION_EXPIRADA'

// El token vive en localStorage compartido: si otra pestaña lo cambia (otro jurado entra o alguien sale),
// esta pestaña se recarga para no seguir actuando con la identidad anterior (I1).
export function vigilarTokenCompartido(recargar = () => window.location.reload()) {
  const alCambiar = (e) => {
    if (e.key === CLAVE_TOKEN || e.key === null) recargar()
  }
  window.addEventListener('storage', alCambiar)
  return () => window.removeEventListener('storage', alCambiar)
}

// 401 de la sesión vigente: cierra sesión y lleva a /login con aviso. La cola de IndexedDB NO se toca:
// las calificaciones pendientes se envían cuando el mismo jurado vuelva a entrar en este dispositivo (I2).
export function manejarSesionExpirada({ auth, calificacion, router }) {
  if (!auth.token) return
  const actual = router.currentRoute.value
  calificacion.reiniciar()
  auth.logout()
  if (actual.path === '/login') return
  router.replace({ path: '/login', query: { motivo: MOTIVO_SESION_EXPIRADA, redirect: actual.fullPath } })
}

export function instalarSesion(router) {
  alSesionExpirada(() =>
    manejarSesionExpirada({ auth: useAuthStore(), calificacion: useCalificacionStore(), router })
  )
  return vigilarTokenCompartido()
}
