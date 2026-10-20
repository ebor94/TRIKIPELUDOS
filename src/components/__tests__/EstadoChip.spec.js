import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EstadoChip from '@/components/EstadoChip.vue'

test('con grande usa text-2xl', () => {
  expect(mount(EstadoChip, { props: { estado: 'PRESENTE', grande: true } }).classes()).toContain('text-2xl')
})
test('sin grande usa text-sm', () => {
  expect(mount(EstadoChip, { props: { estado: 'PRESENTE' } }).classes()).toContain('text-sm')
})
