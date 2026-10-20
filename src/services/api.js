import axios from 'axios'
import { CLAVE_TOKEN } from '@/services/sesion'

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

function crearCliente(baseURL) {
  const cliente = axios.create({ baseURL, timeout: 20000 })
  cliente.interceptors.request.use((config) => {
    const token = tokenStorage.leer()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  cliente.interceptors.response.use((r) => r.data, (e) => Promise.reject(normalizarError(e)))
  return cliente
}

const BASE = import.meta.env.VITE_API_URL || '/api'
export const api = crearCliente(BASE)
export const trk = crearCliente(`${BASE}/trk/v1`)
