import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))

import { trk } from '@/services/api'
import ParticipantesView from '@/views/admin/ParticipantesView.vue'

const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños' }, { id: 2, codigo: 'GRANDES', nombre: 'Grandes' }]
const thor = { id: 't1', mascota_nombre: 'Thor', responsable_nombre: 'Carlos', responsable_documento: '3040', categoria_id: 2, categoria: CATS[1], categoria_propuesta_id: 1, estado: 'PRESENTADO', advertencias_importacion: [{ codigo: 'POSIBLE_DUPLICADO', mensaje: 'Misma mascota en dos categorías' }], notas_importacion: 'validar categoría' }
const thor2 = { id: 't2', mascota_nombre: 'THOR', responsable_nombre: 'Carlos', categoria_id: 2, categoria: CATS[1], estado: 'INSCRITO', advertencias_importacion: null }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  trk.get.mockImplementation(async (url) => (url === '/categorias' ? { data: CATS } : { data: [thor, thor2] }))
})

test('lista con advertencias y notas de importación visibles', async () => {
  const w = mount(ParticipantesView)
  await flushPromises()
  expect(w.text()).toContain('Misma mascota en dos categorías')
  expect(w.text()).toContain('validar categoría')
})

test('confirmar categoría propuesta: pide confirmación al recibir CONFIRMACION_REQUERIDA y reintenta', async () => {
  trk.post
    .mockRejectedValueOnce({ status: 409, motivo: 'CONFIRMACION_REQUERIDA', message: 'Confirmar borrará 2 calificación(es)' })
    .mockResolvedValueOnce({ data: { ...thor, categoria_id: 1, categoria_propuesta_id: null } })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="confirmar-categoria-t1"]').trigger('click')
  await flushPromises()
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('borrará 2'))
  expect(trk.post).toHaveBeenLastCalledWith('/participantes/t1/categoria/confirmar', { confirmar: true })
})

test('fusionar en otro registro', async () => {
  trk.post.mockResolvedValue({ data: thor2 })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="fusionar-t1"]').trigger('click')
  await w.get('[data-test="destino-fusion"]').setValue('t2')
  await w.get('[data-test="confirmar-fusion"]').trigger('click')
  await flushPromises()
  expect(trk.post).toHaveBeenCalledWith('/participantes/t1/fusionar', { destino_id: 't2' })
})

test('choque de jurado en la fusión se muestra', async () => {
  trk.post.mockRejectedValue({ status: 409, motivo: 'FUSION_CON_CHOQUE', message: 'Un mismo jurado calificó ambos registros', errors: [] })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="fusionar-t1"]').trigger('click')
  await w.get('[data-test="destino-fusion"]').setValue('t2')
  await w.get('[data-test="confirmar-fusion"]').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('Un mismo jurado calificó ambos registros')
})

test('editar datos del responsable', async () => {
  trk.patch.mockResolvedValue({ data: { participante: { ...thor, responsable_documento: '999' }, requiere_confirmacion: false } })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="editar-t1"]').trigger('click')
  await w.get('[data-test="campo-responsable_documento"]').setValue('999')
  await w.get('[data-test="guardar-edicion"]').trigger('submit')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/t1', { responsable_documento: '999' })
})

test('al vaciar documento, teléfono o correo se envía null y no cadena vacía', async () => {
  const conTodo = { ...thor, responsable_telefono: '3001234567', responsable_correo: 'a@b.co' }
  trk.get.mockImplementation(async (url) => (url === '/categorias' ? { data: CATS } : { data: [conTodo, thor2] }))
  trk.patch.mockResolvedValue({ data: { participante: conTodo, requiere_confirmacion: false } })
  const w = mount(ParticipantesView)
  await flushPromises()
  await w.get('[data-test="editar-t1"]').trigger('click')
  await w.get('[data-test="campo-responsable_documento"]').setValue('')
  await w.get('[data-test="campo-responsable_telefono"]').setValue('')
  await w.get('[data-test="campo-responsable_correo"]').setValue('')
  await w.get('[data-test="campo-responsable_nombre"]').setValue('')
  await w.get('[data-test="guardar-edicion"]').trigger('submit')
  await flushPromises()
  expect(trk.patch).toHaveBeenCalledWith('/participantes/t1', {
    responsable_documento: null, responsable_telefono: null, responsable_correo: null, responsable_nombre: ''
  })
})
