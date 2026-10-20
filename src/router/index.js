import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { publica: true } },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { permiso: 'administrar' },
    children: [
      { path: '', redirect: '/admin/usuarios' },
      { path: 'usuarios', component: () => import('@/views/admin/UsuariosView.vue') }
    ]
  }
]

export function decidirNavegacion(to, auth) {
  if (to.meta && to.meta.publica) return true
  if (!auth.token) return { path: '/login', query: { redirect: to.fullPath } }
  const permiso = to.matched.map((r) => r.meta && r.meta.permiso).filter(Boolean).pop()
  if (permiso && !auth.tiene(permiso)) return { path: auth.rutaInicio }
  return true
}

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.token && !auth.usuario) {
    try { await auth.cargarPerfil() } catch { /* token inválido: cargarPerfil ya cerró sesión */ }
  }
  return decidirNavegacion(to, auth)
})

export default router
