import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn(() => ({ conectado: { value: true } })) }))
vi.mock('@/utils/descargas', () => ({ descargarBlob: vi.fn() }))

import { trk } from '@/services/api'
import { descargarBlob } from '@/utils/descargas'
import RankingView from '@/views/admin/RankingView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true, ranking_publicado: false, puestos_premiados: 3 }]
const RANKING = {
  categoria: CATS[0],
  criterios: [{ codigo: 'CREATIVIDAD', nombre: 'Creatividad' }, { codigo: 'SEGURIDAD', nombre: 'Seguridad' }],
  empates_sin_resolver: [['a', 'b']],
  filas: [
    { participante_id: 'a', mascota_nombre: 'A', puesto: 1, puntaje_final: 80, promedios: { CREATIVIDAD: 30, SEGURIDAD: 25 }, n_calificaciones: 3, n_jurados: 3, completa: true, premiado: true, empate_sin_resolver: true, participante: { id: 'a', mascota_nombre: 'A' }, calificaciones: [{ id: 9, jurado_nombre: 'J1', total: 80, bloqueada: true }] },
    { participante_id: 'b', mascota_nombre: 'B', puesto: 1, puntaje_final: 80, promedios: { CREATIVIDAD: 30, SEGURIDAD: 25 }, n_calificaciones: 3, n_jurados: 3, completa: true, premiado: true, empate_sin_resolver: true, participante: { id: 'b', mascota_nombre: 'B' }, calificaciones: [] },
    { participante_id: 'c', mascota_nombre: 'C', puesto: null, puntaje_final: 90, promedios: {}, n_calificaciones: 2, n_jurados: 3, completa: false, premiado: false, empate_sin_resolver: false, participante: { id: 'c', mascota_nombre: 'C' }, calificaciones: [] }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATS }
    if (url === '/ranking/1') return { data: RANKING }
    if (url === '/export/resultados.xlsx') return new Blob(['xlsx'])
    throw new Error(url)
  })
})

test('muestra ranking, incompletas y empates sin resolver (HU-10)', async () => {
  const w = mount(RankingView)
  await flushPromises()
  expect(w.text()).toContain('Incompleta (2/3)')
  expect(w.get('[data-test="empates"]').text()).toContain('A')
  expect(w.findAll('[data-test="fila-empate"]')).toHaveLength(2)
})

test('resolver empate envía el orden elegido', async () => {
  trk.put.mockResolvedValue({ data: { ...RANKING, empates_sin_resolver: [] } })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="bajar-empate-a"]').trigger('click')
  await w.get('[data-test="guardar-desempate"]').trigger('click')
  await flushPromises()
  expect(trk.put).toHaveBeenCalledWith('/ranking/1/desempate', { orden: ['b', 'a'] })
})

test('cerrar, publicar, mostrar en pantalla y exportar', async () => {
  trk.post.mockResolvedValue({ data: { ...CATS[0], abierta: false } })
  trk.put.mockResolvedValue({ data: {} })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="cerrar"]').trigger('click')
  expect(trk.post).toHaveBeenCalledWith('/categorias/1/cerrar')
  await w.get('[data-test="publicar"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/categorias/1/publicar')
  await w.get('[data-test="mostrar-pantalla"]').trigger('click')
  expect(trk.put).toHaveBeenCalledWith('/evento/pantalla', { modo: 'RANKING', categoria_id: 1 })
  await w.get('[data-test="exportar"]').trigger('click')
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/export/resultados.xlsx', { responseType: 'blob' })
  expect(descargarBlob).toHaveBeenCalled()
})

test('puestos premiados y desbloqueo de una calificación', async () => {
  trk.patch.mockResolvedValue({ data: { ...CATS[0], puestos_premiados: 5 } })
  trk.post.mockResolvedValue({ data: { id: 9, bloqueada: false } })
  const w = mount(RankingView)
  await flushPromises()
  await w.get('[data-test="puestos"]').setValue('5')
  await w.get('[data-test="guardar-puestos"]').trigger('click')
  expect(trk.patch).toHaveBeenCalledWith('/categorias/1', { puestos_premiados: 5 })
  await w.get('[data-test="detalle-a"]').trigger('click')
  await w.get('[data-test="desbloquear-9"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/calificaciones/9/desbloquear')
})
