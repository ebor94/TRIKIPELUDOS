import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FotoMascota from '@/components/FotoMascota.vue'

const base = { mascota_nombre: 'Canela', especie: 'PERRO', categoria: { codigo: 'PEQUENOS' } }

test('usa la foto oficial si existe', () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: '/uploads/trk/fotos/a.jpg', foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.get('img').attributes('src')).toBe('/uploads/trk/fotos/a.jpg')
  expect(w.get('img').attributes('alt')).toBe('Canela')
})

test('por defecto solo la foto oficial (pasarela): sin oficial muestra el avatar aunque haya foto de registro', () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: null, foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.find('img').exists()).toBe(false)
  expect(w.get('[data-test="avatar"]').attributes('data-tipo')).toBe('perro')
})

test('origen "registro": la foto del formulario (Drive → imagen); si falla, avatar', async () => {
  const w = mount(FotoMascota, { props: { origen: 'registro', participante: { ...base, foto_url: '/o.jpg', foto_inscripcion_url: 'https://drive.google.com/file/d/IDX/view' } } })
  expect(w.get('img').attributes('src')).toBe('https://drive.google.com/thumbnail?id=IDX&sz=w1000')
  await w.get('img').trigger('error')
  expect(w.find('img').exists()).toBe(false)
})

test('origen "perfil": registro primero y, si no hay, la oficial', () => {
  const conRegistro = mount(FotoMascota, { props: { origen: 'perfil', participante: { ...base, foto_url: '/o.jpg', foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(conRegistro.get('img').attributes('src')).toBe('https://x/y.jpg')
  const sinRegistro = mount(FotoMascota, { props: { origen: 'perfil', participante: { ...base, foto_url: '/o.jpg', foto_inscripcion_url: null } } })
  expect(sinRegistro.get('img').attributes('src')).toBe('/o.jpg')
})

test('avatar de gato y de familia', () => {
  const gato = mount(FotoMascota, { props: { participante: { ...base, especie: 'GATO', foto_url: null } } })
  expect(gato.get('[data-test="avatar"]').attributes('data-tipo')).toBe('gato')
  const familia = mount(FotoMascota, { props: { participante: { ...base, categoria: { codigo: 'FAMILIAR' }, foto_url: null } } })
  expect(familia.get('[data-test="avatar"]').attributes('data-tipo')).toBe('familia')
})
