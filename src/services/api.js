import axios from 'axios'

export const CLAVE_TOKEN = 'trk_token'

export const tokenStorage = {
  leer() {
    try { return localStorage.getItem(CLAVE_TOKEN) } catch { return null }
  },
  guardar(token) {
    try {
      if (token) localStorage.setItem(CLAVE_TOKEN, token)
      else localStorage.removeItem(CLAVE_TOKEN)
    } catch { /* almacenamiento no disponible */ }
  }
}

// Contrato de error TRK (§9.0) → objeto plano para la UI.
export function normalizarError(error) {
  const r = error && error.response
  return {
    status: r ? r.status : 0,
    codigo: r && r.data ? r.data.error || null : null,
    motivo: r ? (r.data && r.data.motivo) || 'ERROR' : 'SIN_CONEXION',
    message: r ? (r.data && r.data.message) || 'Ocurrió un error' : 'Sin conexión con el servidor',
    errors: (r && r.data && r.data.errors) || []
  }
}

// Aviso de sesión invalidada (PIN regenerado, token vencido). Lo registra la app al arrancar (I2).
let alExpirar = null
export function alSesionExpirada(fn) {
  alExpirar = fn
}
// Los 401 de las rutas de autenticación significan credenciales malas o perfil inválido (lo maneja el guard).
const esRutaAuth = (url = '') => /^\/?auth\//.test(url)

function avisarSiExpiro(e, err) {
  if (err.status !== 401 || !alExpirar || esRutaAuth(e?.config?.url)) return
  const actual = tokenStorage.leer()
  const usado = e?.config?.headers?.Authorization
  // Solo si el 401 es de la sesión vigente: un 401 tardío de un token ya reemplazado no cierra la sesión nueva.
  if (actual && usado === `Bearer ${actual}`) alExpirar(err)
}

function crearCliente(baseURL) {
  const cliente = axios.create({ baseURL, timeout: 20000 })
  cliente.interceptors.request.use((config) => {
    const token = tokenStorage.leer()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  cliente.interceptors.response.use(
    (r) => r.data,
    (e) => {
      const err = normalizarError(e)
      avisarSiExpiro(e, err)
      return Promise.reject(err)
    }
  )
  return cliente
}

const BASE = import.meta.env.VITE_API_URL || '/api'
export const api = crearCliente(BASE)
export const trk = crearCliente(`${BASE}/trk/v1`)
