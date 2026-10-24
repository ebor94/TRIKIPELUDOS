import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => null, guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({ useTiempoReal: vi.fn((o) => { o.sincronizar(); return { conectado: { value: true } } }) }))

import { trk } from '@/services/api'
import { useTiempoReal } from '@/composables/useTiempoReal'
import PantallaView from '@/views/PantallaView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('modo pasarela: foto grande, nombre, disfraz y categoría (HU-9 CA1), sin login', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: { id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja', categoria: { nombre: 'Pequeños' }, foto_url: '/f.jpg' } } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(useTiempoReal.mock.calls[0][0].token).toBeNull()
  expect(w.text()).toContain('Canela')
  expect(w.text()).toContain('Bruja')
  expect(w.text()).toContain('Pequeños')
  expect(w.get('img[alt="Canela"]').attributes('src')).toBe('/f.jpg')
})

test('sin nadie en pasarela muestra el logo del evento', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: null } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.find('[data-test="logo"]').exists()).toBe(true)
})

test('modo ranking sin contenido propio muestra el logo (no queda en blanco)', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'RANKING', categoria_pantalla: null, ranking: null, en_pasarela: null } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.find('[data-test="logo"]').exists()).toBe(true)
})

test('modo ranking: muestra el podio de la categoría publicada', async () => {
  trk.get.mockResolvedValue({ data: {
    modo_pantalla: 'RANKING', categoria_pantalla: { nombre: 'Pequeños' }, en_pasarela: null,
    ranking: { categoria: { nombre: 'Pequeños', puestos_premiados: 3 }, filas: [{ participante_id: 'a', mascota_nombre: 'Canela', puesto: 1, puntaje_final: 91.5, premiado: true, completa: true, participante: { id: 'a', mascota_nombre: 'Canela' } }] }
  } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="podio"]').text()).toContain('Canela')
  expect(w.text()).toContain('91.5')
})

test('en espera muestra la portada: logo oficial y la imagen de mascotas disfrazadas', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: null } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="logo"]').attributes('src')).toContain('marca/logo-trikipeludos.webp')
  expect(w.get('[data-test="portada-mascotas"]').attributes('src')).toContain('marca/mascotas.webp')
})

const pasarelaCanela = { modo_pantalla: 'PASARELA', categoria_pantalla: null, ranking: null, en_pasarela: { id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja', categoria: { nombre: 'Pequeños' }, foto_url: '/f.jpg' } }

test('diseño del evento: fondo, logo, patrocinadores y etiqueta "En pasarela"', async () => {
  trk.get.mockResolvedValue({ data: pasarelaCanela })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="pantalla"]').attributes('style')).toContain('marca/fondo-pantalla.webp')
  expect(w.get('[data-test="logo-texto"]').attributes('src')).toContain('marca/logo-texto.webp')
  expect(w.get('[data-test="patrocinadores"]').attributes('src')).toContain('marca/patrocinadores.webp')
  expect(w.get('[data-test="etiqueta"]').text()).toBe('En pasarela')
  expect(w.get('[data-test="calabaza"]').attributes('src')).toContain('marca/calabaza.webp')
})

test('modo ganadores: podio 2-1-3 con trofeos, nombre y puntaje, y la categoría bajo el logo', async () => {
  const fila = (id, nombre, puesto, puntaje) => ({ participante_id: id, mascota_nombre: nombre, puesto, puntaje_final: puntaje, premiado: true, completa: true, participante: { id, mascota_nombre: nombre } })
  trk.get.mockResolvedValue({ data: {
    modo_pantalla: 'RANKING', categoria_pantalla: { nombre: 'Caninos pequeños' }, en_pasarela: null,
    ranking: { categoria: { nombre: 'Caninos pequeños', puestos_premiados: 3 }, filas: [fila('c', 'Caramelo', 1, 98), fila('d', 'Dalila', 2, 77), fila('a', 'Ares', 3, 58)] }
  } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="etiqueta"]').text()).toBe('Ganadores')
  expect(w.get('[data-test="categoria-ranking"]').text()).toBe('Caninos pequeños')
  const puestos = w.findAll('[data-test="podio"] [data-puesto]')
  expect(puestos.map((p) => p.attributes('data-puesto'))).toEqual(['2', '1', '3'])
  expect(puestos[1].get('img[data-test="trofeo"]').attributes('src')).toContain('marca/trofeo-1.webp')
  expect(puestos[1].text()).toContain('Caramelo')
  expect(puestos[1].text()).toContain('98')
})

test('la categoría de quien está en pasarela se muestra con su color', async () => {
  trk.get.mockResolvedValue({ data: { ...pasarelaCanela, en_pasarela: { ...pasarelaCanela.en_pasarela, categoria: { nombre: 'Pequeños', color: '#FD7218' } } } })
  const w = mount(PantallaView)
  await flushPromises()
  expect(w.get('[data-test="categoria-pasarela"]').attributes('style')).toContain('background-color')
})
