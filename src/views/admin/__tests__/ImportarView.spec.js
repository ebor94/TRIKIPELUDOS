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
    { indice: 0, linea: 2, datos: { mascota_nombre: 'Rocky', responsable_nombre: 'Pedro', categoria_codigo: 'FELINOS' }, advertencias: [{ codigo: 'ESPECIE_CATEGORIA_INCOHERENTE', mensaje: 'Perro inscrito en FELINOS', sugerencia: 'PEQ_MED' }], errores: [], grupo_duplicado: null, conservar_por_defecto: true },
    { indice: 1, linea: 3, datos: { mascota_nombre: 'Thor', responsable_nombre: 'Carlos', categoria_codigo: 'GRANDES' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: true },
    { indice: 2, linea: 4, datos: { mascota_nombre: 'THOR', responsable_nombre: 'Carlos', categoria_codigo: 'FAMILIAR' }, advertencias: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota' }], errores: [], grupo_duplicado: 'dup-1', conservar_por_defecto: false }
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  trk.get.mockResolvedValue({ data: [
    { id: 1, codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, { id: 2, codigo: 'GRANDES', nombre: 'Caninos grandes' },
    { id: 3, codigo: 'FELINOS', nombre: 'Felinos' }, { id: 4, codigo: 'FAMILIAR', nombre: 'Familiar' }
  ] })
})

async function cargarArchivo(w) {
  trk.post.mockResolvedValueOnce({ data: vistaPrevia })
  const input = w.get('[data-test="archivo"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'inscripciones.csv', { type: 'text/csv' })] })
  await input.trigger('change')
  await flushPromises()
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
    decisiones: { omitir: [], conservar: { 'dup-1': 2 }, categoria: { 0: 'PEQ_MED' } }
  })
  expect(w.text()).toContain('2 creados')
})
