import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ControlPuntaje from '@/components/ControlPuntaje.vue'

const criterio = { id: 1, nombre: 'Creatividad', descripcion: 'Idea novedosa', puntaje_max: 35 }
const montar = (modelValue = null) => mount(ControlPuntaje, { props: { criterio, modelValue, 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) } })
let w

test('muestra nombre, descripción y máximo visible; sin tocar muestra —', () => {
  w = montar()
  expect(w.text()).toContain('Creatividad')
  expect(w.text()).toContain('Idea novedosa')
  expect(w.text()).toContain('— / 35')
  expect(w.get('input[type="range"]').attributes('max')).toBe('35')
})

test('± respeta límites y arranca explícito desde sin tocar', async () => {
  w = montar()
  await w.get('[data-test="menos"]').trigger('click')
  expect(w.props('modelValue')).toBe(0)
  await w.get('[data-test="menos"]').trigger('click')
  expect(w.props('modelValue')).toBe(0)
  await w.setProps({ modelValue: 35 })
  await w.get('[data-test="mas"]').trigger('click')
  expect(w.props('modelValue')).toBe(35)
})

test('el deslizador emite enteros', async () => {
  w = montar(0)
  await w.get('input[type="range"]').setValue('17')
  expect(w.props('modelValue')).toBe(17)
})

test('botones de ±44 px', () => {
  w = montar()
  expect(w.get('[data-test="mas"]').classes()).toContain('min-w-tactil')
})
