import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))
vi.mock('@/utils/imagen', () => ({ comprimirImagen: vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' })) }))

import { trk } from '@/services/api'
import { comprimirImagen } from '@/utils/imagen'
import CabinaView from '@/views/CabinaView.vue'

const CATEGORIAS = [{ id: 1, codigo: 'PEQUENOS', nombre: 'Caninos pequeños', color: '#FF9900' }, { id: 3, codigo: 'FELINOS', nombre: 'Felinos', color: '#00B0F0' }]
const canela = { id: 'p1', mascota_nombre: 'Canela', responsable_nombre: 'Laura Gómez', responsable_telefono: '3001112233', estado: 'INSCRITO', categoria_id: 1, categoria: CATEGORIAS[0], especie: 'PERRO', disfraz_nombre: 'Bruja', foto_url: null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) // flushPromises usa setImmediate
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATEGORIAS }
    return { data: [canela] }
  })
})

async function buscarYAbrir(w) {
  await w.get('[data-test="buscar"]').setValue('canela')
  vi.advanceTimersByTime(350)
  await flushPromises()
  await w.get('[data-test="participante-p1"]').trigger('click')
  await flushPromises()
}

test('busca con espera y muestra resultados', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="buscar"]').setValue('canela')
  vi.advanceTimersByTime(350)
  await flushPromises()
  expect(trk.get).toHaveBeenCalledWith('/participantes', { params: { q: 'canela' } })
  expect(w.text()).toContain('Canela')
})

test('botón Tomar foto usa la cámara trasera y hay opción de galería (CA2)', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  const camara = w.get('[data-test="input-camara"]')
  expect(camara.attributes('accept')).toBe('image/*')
  expect(camara.attributes('capture')).toBe('environment')
  expect(w.get('[data-test="input-galeria"]').attributes('capture')).toBeUndefined()
})

test('toma foto: comprime, sube con progreso y queda PRESENTE (CA3, CA4)', async () => {
  trk.post.mockImplementation(async (url, form, config) => {
    config.onUploadProgress({ loaded: 50, total: 100 })
    return { data: { ...canela, estado: 'PRESENTE', foto_url: '/uploads/trk/fotos/n.jpg' } }
  })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  const input = w.get('[data-test="input-camara"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['raw'], 'f.jpg', { type: 'image/jpeg' })] })
  await input.trigger('change')
  await flushPromises()
  expect(comprimirImagen).toHaveBeenCalled()
  expect(trk.post).toHaveBeenCalledWith('/participantes/p1/foto', expect.any(FormData), expect.objectContaining({ onUploadProgress: expect.any(Function) }))
  expect(w.text()).toContain('Presente')
  expect(w.get('[data-test="repetir"]').exists()).toBe(true)
})

test('editar disfraz y categoría; avisa si queda como propuesta', async () => {
  trk.patch.mockResolvedValue({ data: { participante: { ...canela, disfraz_nombre: 'Hada', categoria_propuesta_id: 3 }, requiere_confirmacion: true } })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  await w.get('[data-test="disfraz"]').setValue('Hada')
  await w.get('[data-test="categoria"]').setValue('3')
  await w.get('[data-test="guardar-datos"]').trigger('submit')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/p1', { disfraz_nombre: 'Hada', categoria_id: 3 })
  expect(w.text()).toContain('El administrador debe confirmar el cambio de categoría')
})

test('alta de último minuto (CA6)', async () => {
  trk.post.mockResolvedValue({ data: { ...canela, id: 'p9', mascota_nombre: 'Pelusa' } })
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="abrir-alta"]').trigger('click')
  await w.get('[data-test="alta-responsable"]').setValue('Nora Díaz')
  await w.get('[data-test="alta-telefono"]').setValue('3009998877')
  await w.get('[data-test="alta-mascota"]').setValue('Pelusa')
  await w.get('[data-test="alta-especie"]').setValue('GATO')
  await w.get('[data-test="alta-categoria"]').setValue('3')
  await w.get('[data-test="form-alta"]').trigger('submit')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/participantes', { responsable_nombre: 'Nora Díaz', responsable_telefono: '3009998877', mascota_nombre: 'Pelusa', especie: 'GATO', categoria_id: 3 })
  expect(w.text()).toContain('Pelusa')
})

const rex = { ...canela, id: 'p2', mascota_nombre: 'Rex', disfraz_nombre: '' }

function diferido() {
  let resolver
  const promesa = new Promise((r) => { resolver = r })
  return { promesa, resolver }
}

async function elegirFoto(w, selector = '[data-test="input-camara"]') {
  const input = w.get(selector)
  Object.defineProperty(input.element, 'files', { value: [new File(['raw'], 'f.jpg', { type: 'image/jpeg' })], configurable: true })
  await input.trigger('change')
}

test('la foto se sube al participante original aunque se abra otro durante la compresión', async () => {
  trk.get.mockImplementation(async (url) => (url === '/categorias' ? { data: CATEGORIAS } : { data: [canela, rex] }))
  const d = diferido()
  comprimirImagen.mockImplementationOnce(() => d.promesa)
  trk.post.mockResolvedValue({ data: { ...canela, estado: 'PRESENTE', foto_url: '/x.jpg' } })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  await elegirFoto(w)
  await w.get('[data-test="participante-p2"]').trigger('click')
  await flushPromises()
  d.resolver(new Blob(['jpg'], { type: 'image/jpeg' }))
  await flushPromises()
  expect(trk.post.mock.calls[0][0]).toBe('/participantes/p1/foto')
  expect(w.get('section h2').text()).toBe('Rex')
})

test('si falla la subida permite reintentar sin recomprimir', async () => {
  trk.post
    .mockRejectedValueOnce({ status: 0, motivo: 'SIN_CONEXION', message: 'Sin conexión con el servidor' })
    .mockResolvedValueOnce({ data: { ...canela, estado: 'PRESENTE', foto_url: '/x.jpg' } })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  await elegirFoto(w)
  await flushPromises()
  const boton = w.get('[data-test="reintentar"]')
  expect(boton.text()).toContain('Reintentar subida')
  await boton.trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledTimes(2)
  expect(trk.post.mock.calls[1][0]).toBe('/participantes/p1/foto')
  expect(comprimirImagen).toHaveBeenCalledTimes(1)
  expect(w.text()).toContain('Presente')
  expect(w.find('[data-test="reintentar"]').exists()).toBe(false)
})

test('los inputs de foto se deshabilitan mientras sube', async () => {
  const d = diferido()
  trk.post.mockImplementation(() => d.promesa)
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  await elegirFoto(w)
  await flushPromises()
  expect(w.get('[data-test="input-camara"]').attributes('disabled')).toBeDefined()
  expect(w.get('[data-test="input-galeria"]').attributes('disabled')).toBeDefined()
  d.resolver({ data: { ...canela, estado: 'PRESENTE' } })
  await flushPromises()
  expect(w.get('[data-test="input-camara"]').attributes('disabled')).toBeUndefined()
})

test('una búsqueda vieja que responde tarde no pisa a la última', async () => {
  const lenta = diferido()
  let n = 0
  trk.get.mockImplementation(async (url) => {
    if (url === '/categorias') return { data: CATEGORIAS }
    n++
    return n === 1 ? lenta.promesa : { data: [rex] }
  })
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="buscar"]').setValue('ca')
  vi.advanceTimersByTime(350)
  await w.get('[data-test="buscar"]').setValue('rex')
  vi.advanceTimersByTime(350)
  await flushPromises()
  lenta.resolver({ data: [canela] })
  await flushPromises()
  expect(w.text()).toContain('Rex')
  expect(w.text()).not.toContain('Canela')
})

test('marcar como ausente actualiza el estado', async () => {
  trk.patch.mockResolvedValue({ data: { ...canela, estado: 'AUSENTE' } })
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  const boton = w.findAll('button').find((b) => b.text() === 'Marcar como ausente')
  await boton.trigger('click')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/p1/estado', { estado: 'AUSENTE' })
  expect(w.text()).toContain('Ausente')
})

test('ficha: chip con color y nombre de la categoría elegida junto al select, y opciones coloreadas', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await buscarYAbrir(w)
  let chip = w.get('[data-test="categoria-chip"]')
  expect(chip.text()).toContain('Caninos pequeños')
  expect(chip.element.style.backgroundColor).toBe('rgb(255, 153, 0)')
  await w.get('[data-test="categoria"]').setValue('3')
  chip = w.get('[data-test="categoria-chip"]')
  expect(chip.text()).toContain('Felinos')
  expect(chip.element.style.backgroundColor).toBe('rgb(0, 176, 240)')
  const opcion = w.findAll('[data-test="categoria"] option').find((o) => o.text() === 'Felinos')
  expect(opcion.element.style.backgroundColor).toBe('rgb(0, 176, 240)')
})

test('alta: el chip aparece al elegir categoría', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="abrir-alta"]').trigger('click')
  expect(w.find('[data-test="alta-categoria-chip"]').exists()).toBe(false)
  await w.get('[data-test="alta-categoria"]').setValue('3')
  const chip = w.get('[data-test="alta-categoria-chip"]')
  expect(chip.text()).toContain('Felinos')
  expect(chip.element.style.backgroundColor).toBe('rgb(0, 176, 240)')
})

test('resultados de búsqueda: la categoría se ve como chip con su color', async () => {
  const w = mount(CabinaView)
  await flushPromises()
  await w.get('[data-test="buscar"]').setValue('canela')
  vi.advanceTimersByTime(350)
  await flushPromises()
  const chip = w.get('[data-test="participante-p1"] [data-test="chip-categoria"]')
  expect(chip.text()).toContain('Caninos pequeños')
  expect(chip.element.style.backgroundColor).toBe('rgb(255, 153, 0)')
})
