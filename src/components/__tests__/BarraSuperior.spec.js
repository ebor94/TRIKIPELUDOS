import { test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: {}, tokenStorage: { leer: () => 't', guardar: () => {}, borrar: () => {} } }))

import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import BarraSuperior from '@/components/BarraSuperior.vue'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

test('Salir reinicia la cola de calificaciones antes de cerrar sesión', async () => {
  const orden = []
  const auth = useAuthStore()
  auth.logout = vi.fn(() => orden.push('logout'))
  const cola = useCalificacionStore()
  cola.reiniciar = vi.fn(() => orden.push('reiniciar'))
  const w = mount(BarraSuperior, { props: { titulo: 'X' } })
  await w.get('button').trigger('click')
  expect(orden).toEqual(['reiniciar', 'logout'])
  expect(push).toHaveBeenCalledWith('/login')
})
