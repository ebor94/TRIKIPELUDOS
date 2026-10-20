import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PodioRanking from '@/components/PodioRanking.vue'

const fila = (id, puesto, puntaje, extra = {}) => ({
  participante_id: id, mascota_nombre: id, puesto, puntaje_final: puntaje, premiado: puesto !== null && puesto <= 3,
  completa: puesto !== null, participante: { id, mascota_nombre: id, foto_url: `/${id}.jpg` }, ...extra
})
const ranking = {
  categoria: { nombre: 'Pequeños', puestos_premiados: 3 },
  filas: [fila('A', 1, 90), fila('B', 2, 85), fila('C', 3, 80), fila('D', 4, 70), fila('E', null, 95, { n_calificaciones: 2, n_jurados: 3 })]
}

test('podio con los 3 primeros en orden 2-1-3 con foto y puntaje (HU-9 CA2)', () => {
  const w = mount(PodioRanking, { props: { ranking } })
  const podio = w.findAll('[data-test="podio"] [data-puesto]')
  expect(podio.map((p) => p.attributes('data-puesto'))).toEqual(['2', '1', '3'])
  expect(w.get('[data-puesto="1"]').text()).toContain('90')
  expect(w.get('[data-puesto="1"] img').attributes('src')).toBe('/A.jpg')
})

test('luego la tabla completa, con incompletas marcadas', () => {
  const w = mount(PodioRanking, { props: { ranking } })
  const tabla = w.get('[data-test="tabla"]').text()
  for (const n of ['A', 'B', 'C', 'D', 'E']) expect(tabla).toContain(n)
  expect(tabla).toContain('Incompleta')
})
