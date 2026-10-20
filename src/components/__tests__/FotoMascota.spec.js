import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FotoMascota from '@/components/FotoMascota.vue'

const base = { mascota_nombre: 'Canela', especie: 'PERRO', categoria: { codigo: 'PEQ_MED' } }

test('usa la foto oficial si existe', () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: '/uploads/trk/fotos/a.jpg', foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.get('img').attributes('src')).toBe('/uploads/trk/fotos/a.jpg')
  expect(w.get('img').attributes('alt')).toBe('Canela')
})

test('si no hay oficial usa la de inscripción; si falla, avatar', async () => {
  const w = mount(FotoMascota, { props: { participante: { ...base, foto_url: null, foto_inscripcion_url: 'https://x/y.jpg' } } })
  expect(w.get('img').attributes('src')).toBe('https://x/y.jpg')
  await w.get('img').trigger('error')
  expect(w.find('img').exists()).toBe(false)
  expect(w.get('[data-test="avatar"]').attributes('data-tipo')).toBe('perro')
})

test('avatar de gato y de familia', () => {
  const gato = mount(FotoMascota, { props: { participante: { ...base, especie: 'GATO', foto_url: null } } })
  expect(gato.get('[data-test="avatar"]').attributes('data-tipo')).toBe('gato')
  const familia = mount(FotoMascota, { props: { participante: { ...base, categoria: { codigo: 'FAMILIAR' }, foto_url: null } } })
  expect(familia.get('[data-test="avatar"]').attributes('data-tipo')).toBe('familia')
})
