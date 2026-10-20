import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FichaMascota from '@/components/FichaMascota.vue'

const p = {
  id: 'a', mascota_nombre: 'Canela', disfraz_nombre: 'Bruja de Oz', raza: 'Criollo', edad_texto: '3', sexo: 'HEMBRA',
  especie: 'PERRO', categoria: { codigo: 'PEQ_MED', nombre: 'Caninos pequeños y medianos' }, responsable_primer_nombre: 'Laura',
  responsable_telefono: '3001112233'
}

test('muestra los campos de HU-6 CA1 y nada más del responsable', () => {
  const w = mount(FichaMascota, { props: { participante: p, grande: true } })
  for (const texto of ['Canela', 'Bruja de Oz', 'Criollo', 'Edad: 3', 'Hembra', 'Caninos pequeños y medianos', 'Laura']) expect(w.text()).toContain(texto)
  expect(w.text()).not.toContain('3001112233')
})

test('en modo grande todo el texto es ≥ 24 px (text-2xl o mayor)', () => {
  const w = mount(FichaMascota, { props: { participante: p, grande: true } })
  for (const el of w.findAll('[data-texto]')) expect(el.classes().some((c) => /^text-(2xl|3xl|4xl|5xl|6xl)$/.test(c))).toBe(true)
})
