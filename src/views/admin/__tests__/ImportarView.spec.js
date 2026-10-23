import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({
  api: {},
  trk: { get: vi.fn(), post: vi.fn() },
  tokenStorage: { leer: () => null, guardar: () => {} }
}))

import { trk } from '@/services/api'
import ImportarView from '@/views/admin/ImportarView.vue'

const vistaPrevia = {
  preview_token: 'f'.repeat(64),
  archivo_nombre: 'inscripciones.csv',
  resumen: { total: 3, ok: 1, con_advertencias: 2, con_errores: 0, grupos_duplicados: 1 },
  filas: [
    { indice: 0, linea: 2, datos: { mascota_nombre: 'Rocky', responsable_nombre: 'Pedro', categoria_codigo: 'FELINOS' }, advertencias: [{ codigo: 'ESPECIE_CATEGORIA_INCOHERENTE', mensaje: 'Perro inscrito en FELINOS', sugerencia: 'PEQUENOS' }], errores: [], grupo_duplicado: null, conservar_por_defecto: true },
    { indice: 1, linea: 3, datos: { mascota_nombre: 'Thor', responsable_nombre: 'Carlos', categoria_codigo: 'GRANDES' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: true },
    { indice: 2, linea: 4, datos: { mascota_nombre: 'THOR', responsable_nombre: 'Carlos', categoria_codigo: 'FAMILIAR' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: false }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [
    { id: 1, codigo: 'PEQUENOS', nombre: 'Caninos pequeños' }, { id: 5, codigo: 'MEDIANOS', nombre: 'Caninos medianos' },
    { id: 2, codigo: 'GRANDES', nombre: 'Caninos grandes' },
    { id: 3, codigo: 'FELINOS', nombre: 'Felinos' }, { id: 4, codigo: 'FAMILIAR', nombre: 'Familiar' }
  ] })
})

const vistaConError = {
  preview_token: 'e'.repeat(64),
  archivo_nombre: 'errores.csv',
  resumen: { total: 1, ok: 0, con_advertencias: 0, con_errores: 1, grupos_duplicados: 0 },
  filas: [
    { indice: 0, linea: 2, datos: { mascota_nombre: 'Nube', responsable_nombre: 'Ana', categoria_codigo: null }, advertencias: [], errores: [{ codigo: 'CATEGORIA_DESCONOCIDA', mensaje: 'Categoría no reconocida' }], grupo_duplicado: null, conservar_por_defecto: false }
  ]
}

const vistaSinNombres = {
  preview_token: 'a'.repeat(64),
  archivo_nombre: 'sinnombres.csv',
  resumen: { total: 3, ok: 3, con_advertencias: 0, con_errores: 0, grupos_duplicados: 0 },
  filas: [
    { indice: 0, linea: 2, datos: { mascota_nombre: '', responsable_nombre: 'Ana', categoria_codigo: 'GRANDES' }, advertencias: [], errores: [], grupo_duplicado: null, conservar_por_defecto: false },
    { indice: 1, linea: 3, datos: { mascota_nombre: 'Kira', responsable_nombre: '', categoria_codigo: 'GRANDES' }, advertencias: [], errores: [], grupo_duplicado: null, conservar_por_defecto: false },
    { indice: 2, linea: 4, datos: { mascota_nombre: 'Milo', responsable_nombre: 'Luis', categoria_codigo: 'GRANDES' }, advertencias: [], errores: [], grupo_duplicado: null, conservar_por_defecto: false }
  ]
}

async function cargarArchivo(w, vista = vistaPrevia) {
  trk.post.mockResolvedValueOnce({ data: vista })
  const input = w.get('[data-test="archivo"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['x'], 'inscripciones.csv', { type: 'text/csv' })] })
  await input.trigger('change')
  await flushPromises()
  return input
}

test('sube el CSV y muestra vista previa con advertencias', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  expect(trk.post).toHaveBeenCalledWith('/import/preview', expect.any(FormData))
  expect(w.text()).toContain('Perro inscrito en FELINOS')
  expect(w.text()).toContain('3 filas')
})

test('confirma enviando decisiones: sugerencia aceptada, fila del duplicado y omitidas', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  await w.get('[data-test="sugerencia-0"]').trigger('click')
  await w.get('[data-test="conservar-2"]').setValue(true)
  trk.post.mockResolvedValueOnce({ data: { creados: 2, actualizados: 0, omitidos: 1 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenLastCalledWith('/import/confirm', {
    preview_token: 'f'.repeat(64),
    decisiones: { omitir: [], conservar: { 'dup-1': 2 }, categoria: { 0: 'PEQUENOS' } }
  })
  expect(w.text()).toContain('2 creados')
})

test('tras confirmar muestra cuántas mascotas cambiaron de categoría y cuántas quedaron como propuesta', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  trk.post.mockResolvedValueOnce({ data: { creados: 0, actualizados: 3, omitidos: 0, recategorizados: 2, propuestas: 1 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(w.get('[data-test="recategorizacion"]').text())
    .toBe('2 cambiaron de categoría · 1 quedaron como propuesta para confirmar en Participantes')
})

test('sin cambios de categoría no muestra la línea de recategorización', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  trk.post.mockResolvedValueOnce({ data: { creados: 2, actualizados: 0, omitidos: 1, recategorizados: 0, propuestas: 0 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(w.find('[data-test="recategorizacion"]').exists()).toBe(false)
})

test('omitir una fila la excluye del conteo y envía su índice en decisiones.omitir', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  expect(w.text()).toContain('Se importarán 2 filas')
  await w.get('[data-test="omitir-0"]').setValue(true)
  expect(w.text()).toContain('Se importarán 1 filas')
  trk.post.mockResolvedValueOnce({ data: { creados: 1, actualizados: 0, omitidos: 1 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenLastCalledWith('/import/confirm', {
    preview_token: 'f'.repeat(64),
    decisiones: { omitir: [0], conservar: { 'dup-1': 1 }, categoria: {} }
  })
})

test('fila con error no cuenta hasta elegir categoría y la elegida se envía en decisiones.categoria', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w, vistaConError)
  expect(w.text()).toContain('Se importarán 0 filas')
  expect(w.get('[data-test="confirmar"]').attributes('disabled')).toBeDefined()
  await w.get('[data-test="categoria-0"]').setValue('GRANDES')
  expect(w.text()).toContain('Se importarán 1 filas')
  trk.post.mockResolvedValueOnce({ data: { creados: 1, actualizados: 0, omitidos: 0 } })
  await w.get('[data-test="confirmar"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenLastCalledWith('/import/confirm', {
    preview_token: 'e'.repeat(64),
    decisiones: { omitir: [], conservar: {}, categoria: { 0: 'GRANDES' } }
  })
})

test('fila sin mascota_nombre o responsable_nombre no se cuenta aunque tenga categoría', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w, vistaSinNombres)
  expect(w.text()).toContain('Se importarán 1 filas')
})

test('el botón de sugerencia no usa min-h-0 y los controles táctiles tienen min-h-tactil', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w)
  const sugerencia = w.get('[data-test="sugerencia-0"]')
  expect(sugerencia.classes()).not.toContain('min-h-0')
  expect(sugerencia.classes()).toContain('btn-claro')
  await cargarArchivo(w, vistaConError)
  expect(w.get('[data-test="categoria-0"]').classes()).toContain('min-h-tactil')
  expect(w.get('[data-test="categoria-0"]').element.closest('label').classList).toContain('min-h-tactil')
  expect(w.get('[data-test="omitir-0"]').element.closest('label').classList).toContain('min-h-tactil')
})

test('tras una nueva carga el select de categoría refleja el estado (no queda una opción obsoleta)', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  await cargarArchivo(w, vistaConError)
  await w.get('[data-test="categoria-0"]').setValue('GRANDES')
  await cargarArchivo(w, vistaConError)
  expect(w.get('[data-test="categoria-0"]').element.value).toBe('')
})

test('tras cada subida se limpia el input de archivo para poder volver a elegirlo', async () => {
  const w = mount(ImportarView)
  await flushPromises()
  const input = w.get('[data-test="archivo"]')
  const asignados = []
  Object.defineProperty(input.element, 'value', { configurable: true, get: () => '', set: (v) => asignados.push(v) })
  await cargarArchivo(w)
  expect(asignados).toContain('')
})
