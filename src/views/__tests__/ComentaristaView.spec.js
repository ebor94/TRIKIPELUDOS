import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import ComentaristaView from '@/views/ComentaristaView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños' }, { id: 2, codigo: 'GRANDES', nombre: 'Grandes' }]
const cola = [
  { id: 'a', mascota_nombre: 'Canela', estado: 'PRESENTE', categoria_id: 1, responsable_primer_nombre: 'Laura' },
  { id: 'b', mascota_nombre: 'Rocky', estado: 'PRESENTE', categoria_id: 1, responsable_primer_nombre: 'Pedro' },
  { id: 'c', mascota_nombre: 'Toby', estado: 'PRESENTADO', categoria_id: 1, responsable_primer_nombre: 'Julián' }
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    return { data: cola }
  })
})

test('carga la cola de la primera categoría y muestra la ficha de la primera mascota', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/participantes', { params: { categoria: 1 } })
  expect(w.get('[data-test="ficha"]').text()).toContain('Canela')
})

test('anterior / siguiente dentro de la cola (HU-6 CA2)', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="siguiente"]').trigger('click')
  expect(w.get('[data-test="ficha"]').text()).toContain('Rocky')
  await w.get('[data-test="anterior"]').trigger('click')
  expect(w.get('[data-test="ficha"]').text()).toContain('Canela')
})

test('llamar a pasarela (HU-7 CA1)', async () => {
  trk.post.mockResolvedValue({ data: { ...cola[0], estado: 'EN_PASARELA' } })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="llamar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/pasarela/a')
  expect(w.text()).toContain('En pasarela')
})

test('reordenar con botones accesibles envía el nuevo orden (HU-7 CA3)', async () => {
  trk.put.mockResolvedValue({ data: [cola[1], cola[0], cola[2]] })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="bajar-a"]').trigger('click')
  await flushPromises()
  expect(trk.put).toHaveBeenCalledWith('/pasarela/orden', { categoria_id: 1, orden: ['b', 'a', 'c'] })
})

test('se suscribe a pasarela:cambio y participante:actualizado', async () => {
  mount(ComentaristaView)
  await flushPromises()
  const opciones = useTiempoReal.mock.calls[0][0]
  expect(Object.keys(opciones.eventos)).toEqual(expect.arrayContaining(['pasarela:cambio', 'participante:actualizado', 'foto:nueva']))
})
