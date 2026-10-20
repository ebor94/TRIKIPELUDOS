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

const CATEGORIAS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, { id: 3, codigo: 'FELINOS', nombre: 'Felinos' }]
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
