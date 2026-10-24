import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import ComentaristaView from '@/views/ComentaristaView.vue'

const CATS = [{ id: 1, codigo: 'PEQUENOS', nombre: 'Pequeños', color: '#FF0000' }, { id: 2, codigo: 'GRANDES', nombre: 'Grandes', color: '#FFFF00' }]
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

test('el asa de arrastre y los botones de la fila tienen área táctil de 44 px', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  const asa = w.get('.asa')
  expect(asa.classes()).toEqual(expect.arrayContaining(['min-h-tactil', 'min-w-tactil']))
})

test('el chip de la tarjeta grande es text-2xl', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  expect(w.get('[data-test="ficha"]').find('span.text-2xl.rounded-full').exists()).toBe(true)
})

test('tras reordenar la tarjeta sigue mostrando la misma mascota', async () => {
  trk.put.mockResolvedValue({ data: [cola[0], cola[2], cola[1]] })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="siguiente"]').trigger('click')
  expect(w.get('[data-test="ficha"]').text()).toContain('Rocky')
  await w.get('[data-test="bajar-a"]').trigger('click')
  await flushPromises()
  expect(w.get('[data-test="ficha"]').text()).toContain('Rocky')
})

test('subir envía el nuevo orden (▲)', async () => {
  trk.put.mockResolvedValue({ data: [cola[1], cola[0], cola[2]] })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="subir-b"]').trigger('click')
  await flushPromises()
  expect(trk.put).toHaveBeenCalledWith('/pasarela/orden', { categoria_id: 1, orden: ['b', 'a', 'c'] })
})

test('el comentarista ve el ranking publicado de la categoría (HU-4 CA2)', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    if (url === '/ranking/1') return { data: { categoria: { nombre: 'Pequeños', puestos_premiados: 3 }, filas: [{ participante_id: 'a', mascota_nombre: 'Canela', puesto: 1, puntaje_final: 90, premiado: true, completa: true, participante: { id: 'a', mascota_nombre: 'Canela' } }] } }
    return { data: cola }
  })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="ver-ranking"]').trigger('click')
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/ranking/1')
  expect(w.get('[data-test="podio"]').text()).toContain('Canela')
})

test('si no está publicado lo indica', async () => {
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: null, categoria_pantalla: null, ranking: null } }
    if (url === '/ranking/1') throw { status: 404, motivo: 'RANKING_NO_PUBLICADO', message: 'El ranking de esta categoría aún no se ha publicado' }
    return { data: cola }
  })
  const w = mount(ComentaristaView)
  await flushPromises()
  await w.get('[data-test="ver-ranking"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('aún no se ha publicado')
})

test('pestañas de categoría con su color: la elegida en relleno sólido', async () => {
  const w = mount(ComentaristaView)
  await flushPromises()
  const peq = w.get('[data-test="tab-categoria-1"]')
  const gra = w.get('[data-test="tab-categoria-2"]')
  expect(peq.attributes('aria-pressed')).toBe('true')
  expect(gra.attributes('aria-pressed')).toBe('false')
  expect(peq.element.style.backgroundColor).toBe('rgb(255, 0, 0)')
  expect(peq.element.style.color).toBe('rgb(0, 0, 0)')
  expect(gra.element.style.borderColor).toBe('rgb(255, 255, 0)')
  expect(gra.element.style.backgroundColor).not.toBe('rgb(255, 255, 0)')
  await gra.trigger('click')
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/participantes', { params: { categoria: 2 } })
  expect(w.get('[data-test="tab-categoria-2"]').element.style.backgroundColor).toBe('rgb(255, 255, 0)')
  expect(w.get('[data-test="tab-categoria-2"]').classes()).toContain('btn')
})

import { useEventoStore } from '@/stores/evento'

test('Terminar pasarela: con una mascota en pasarela, confirma y deja la pasarela vacía', async () => {
  window.confirm = vi.fn(() => true)
  trk.post.mockResolvedValue({ data: { en_pasarela: null, terminado: 'c' } })
  const w = mount(ComentaristaView)
  await flushPromises()
  expect(w.find('[data-test="terminar-pasarela"]').exists()).toBe(false)
  useEventoStore().enPasarela = { id: 'c', mascota_nombre: 'Toby' }
  await flushPromises()
  await w.get('[data-test="terminar-pasarela"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/pasarela/terminar')
  expect(useEventoStore().enPasarela).toBeNull()
})

test('Terminar pasarela: si no confirma, no hace nada', async () => {
  window.confirm = vi.fn(() => false)
  const w = mount(ComentaristaView)
  await flushPromises()
  useEventoStore().enPasarela = { id: 'c', mascota_nombre: 'Toby' }
  await flushPromises()
  await w.get('[data-test="terminar-pasarela"]').trigger('click')
  expect(trk.post).not.toHaveBeenCalledWith('/pasarela/terminar')
})
