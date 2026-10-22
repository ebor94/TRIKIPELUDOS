import { test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const tiempoReal = vi.hoisted(() => ({ opciones: null }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, tokenStorage: { leer: () => 't', guardar: () => {} } }))
vi.mock('@/composables/useTiempoReal', () => ({
  useTiempoReal: vi.fn((o) => { tiempoReal.opciones = o; o.sincronizar(); return { conectado: { value: true } } })
}))

import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import JuradoView from '@/views/JuradoView.vue'

// Máximos ficticios (los reales vienen de la API).
const CRITERIOS = [{ id: 1, codigo: 'A', nombre: 'Creatividad', puntaje_max: 9, orden: 1 }, { id: 2, codigo: 'B', nombre: 'Seguridad', puntaje_max: 8, orden: 2 }]
const CATS = [{ id: 1, codigo: 'PEQ_MED', nombre: 'Pequeños', abierta: true }, { id: 3, codigo: 'FELINOS', nombre: 'Felinos', abierta: true }]
const toby = { id: 't', mascota_nombre: 'Toby', estado: 'EN_PASARELA', categoria_id: 1, categoria: { id: 1, nombre: 'Pequeños' }, responsable_primer_nombre: 'Ana' }
const kira = { id: 'k', mascota_nombre: 'Kira', estado: 'PRESENTADO', categoria_id: 1 }
const SIN_FINAL = { estado: null, total: null, puntajes: null }
let respuesta
const matrizBase = () => ({
  categoria: { ...CATS[0] }, categorias: CATS, criterios: CRITERIOS, puntaje_total_max: 17,
  filas: [
    { participante: toby, borrador: { 1: 5, 2: null }, final: { ...SIN_FINAL } },
    { participante: kira, borrador: { 1: 9, 2: 8 }, final: { ...SIN_FINAL } }
  ]
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().usuario = { id: 7, permisos: { calificar: true } }
  respuesta = matrizBase()
  trk.get.mockImplementation(async (url) => {
    if (url === '/evento/estado') return { data: { modo_pantalla: 'PASARELA', en_pasarela: toby, categoria_pantalla: null, ranking: null } }
    if (url === '/jurado/matriz') return { data: respuesta }
    throw new Error(`GET inesperado ${url}`)
  })
  const cola = useCalificacionStore()
  cola.iniciarAutoSincronizacion = vi.fn(() => () => {})
  cola.cargarPendientes = vi.fn(async () => {})
  cola.anotar = vi.fn(async () => {})
})

const montar = async () => {
  const w = mount(JuradoView)
  await flushPromises()
  return w
}

test('tarjeta En pasarela (sin datos del responsable) y matriz de su categoría con la mascota en pasarela primero (CA1, CA2)', async () => {
  const w = await montar()
  const tarjeta = w.get('[data-test="en-pasarela"]')
  expect(tarjeta.text()).toContain('Toby')
  expect(tarjeta.text()).not.toContain('Ana')
  expect(trk.get).toHaveBeenCalledWith('/jurado/matriz', { params: {} })
  expect(w.findAll('[data-test^="fila-"]').map((f) => f.attributes('data-test'))).toEqual(['fila-t', 'fila-k'])
})

test('total y puesto tentativo; una fila incompleta no tiene puesto (CA4)', async () => {
  const w = await montar()
  expect(w.get('[data-test="total-t"]').text()).toBe('5')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('—')
  expect(w.get('[data-test="total-k"]').text()).toBe('17')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('1')
})

test('escribir recalcula total/puesto y anota el borrador de toda la fila (CA5)', async () => {
  const w = await montar()
  await w.get('[data-test="celda-t-2"]').setValue('3')
  expect(w.get('[data-test="total-t"]').text()).toBe('8')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('2')
  expect(useCalificacionStore().anotar).toHaveBeenCalledWith(7, 't', [{ criterio_id: 1, puntaje: 5 }, { criterio_id: 2, puntaje: 3 }])
})

test('empates en el puesto tentativo se marcan con "="', async () => {
  const w = await montar()
  await w.get('[data-test="celda-t-1"]').setValue('9')
  await w.get('[data-test="celda-t-2"]').setValue('8')
  expect(w.get('[data-test="puesto-t"]').text()).toBe('=1')
  expect(w.get('[data-test="puesto-k"]').text()).toBe('=1')
})

test('un borrador local pendiente (IndexedDB) gana sobre el del servidor al cargar', async () => {
  useCalificacionStore().pendientes = { t: { participanteId: 't', puntajes: [{ criterio_id: 1, puntaje: 2 }, { criterio_id: 2, puntaje: 3 }] } }
  const w = await montar()
  expect(w.get('[data-test="celda-t-1"]').element.value).toBe('2')
  expect(w.get('[data-test="total-t"]').text()).toBe('5')
})

test('filas finales con ✓ y sin edición; el botón cuenta solo las no finales y exige filas completas (CA6, CA7)', async () => {
  respuesta.filas[1].final = { estado: 'FINAL', total: 17, puntajes: { 1: 9, 2: 8 } }
  const w = await montar()
  expect(w.get('[data-test="final-k"]').text()).toContain('✓')
  expect(w.get('[data-test="celda-k-1"]').attributes('disabled')).toBeDefined()
  const boton = w.get('[data-test="enviar-final"]')
  expect(boton.text()).toBe('Enviar calificación final (1)')
  expect(boton.attributes('disabled')).toBeDefined()
})

test('envío final: confirma mostrando el ranking tentativo y envía las filas pendientes de la categoría (CA6)', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  const cola = useCalificacionStore()
  cola.finalizar = vi.fn(async () => ({ categoria_id: 1, calificaciones: [{ id: 1 }, { id: 2 }] }))
  const w = await montar()
  await w.get('[data-test="enviar-final"]').trigger('click')
  expect(w.get('[data-test="confirmacion"]').text()).toMatch(/1\. Kira.*17.*2\. Toby.*8/s)
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  expect(cola.finalizar).toHaveBeenCalledWith(7, 1, ['t', 'k'])
  expect(w.find('[data-test="confirmacion"]').exists()).toBe(false)
  expect(w.get('[data-test="aviso"]').text()).toContain('2 mascota(s)')
})

test('el error del envío final se muestra (p. ej. 422 CALIFICACION_INCOMPLETA)', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  useCalificacionStore().finalizar = vi.fn(async () => { throw { status: 422, motivo: 'CALIFICACION_INCOMPLETA', message: 'Faltan puntajes de: Toby', errors: [] } })
  const w = await montar()
  await w.get('[data-test="enviar-final"]').trigger('click')
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toContain('Faltan puntajes de: Toby')
})

test('sigue la pasarela en vivo; si el jurado elige otra categoría la conserva hasta que vuelva a la de la pasarela (CA1)', async () => {
  const w = await montar()
  trk.get.mockClear()
  tiempoReal.opciones.eventos['pasarela:cambio']({ participante: { ...kira, estado: 'EN_PASARELA' } })
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: {} })

  await w.get('[data-test="selector-categoria"]').setValue('3')
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: { categoria: 3 } })
  tiempoReal.opciones.eventos['pasarela:cambio']({ participante: toby })
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: { categoria: 3 } })

  await w.get('[data-test="selector-categoria"]').setValue('1')
  await flushPromises()
  expect(trk.get).toHaveBeenLastCalledWith('/jurado/matriz', { params: {} })
})

test('categoría cerrada: casillas y botón deshabilitados con aviso', async () => {
  respuesta.categoria.abierta = false
  const w = await montar()
  expect(w.text()).toContain('La categoría está cerrada')
  expect(w.get('[data-test="celda-t-1"]').attributes('disabled')).toBeDefined()
  expect(w.get('[data-test="enviar-final"]').attributes('disabled')).toBeDefined()
})

test('arranca la auto-sincronización de la cola y la detiene al desmontar', async () => {
  const detener = vi.fn()
  const cola = useCalificacionStore()
  cola.iniciarAutoSincronizacion = vi.fn(() => detener)
  const w = await montar()
  expect(cola.iniciarAutoSincronizacion).toHaveBeenCalledWith(7)
  w.unmount()
  expect(detener).toHaveBeenCalledTimes(1)
})

test('al montar carga la cola local y la sincroniza con el servidor', async () => {
  const cola = useCalificacionStore()
  cola.sincronizar = vi.fn(async () => {})
  await montar()
  expect(cola.cargarPendientes).toHaveBeenCalledWith(7)
  expect(cola.sincronizar).toHaveBeenCalledWith(7)
})

test('mientras se envía la calificación final las casillas quedan deshabilitadas', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  let terminar
  const cola = useCalificacionStore()
  cola.finalizar = vi.fn(() => new Promise((r) => { terminar = r }))
  const w = await montar()
  expect(w.get('[data-test="celda-t-1"]').attributes('disabled')).toBeUndefined()
  await w.get('[data-test="enviar-final"]').trigger('click')
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  expect(w.get('[data-test="celda-t-1"]').attributes('disabled')).toBeDefined()
  expect(w.get('[data-test="confirmar-final"]').attributes('disabled')).toBeDefined()
  terminar({ categoria_id: 1, calificaciones: [{ id: 1 }] })
  await flushPromises()
  expect(w.get('[data-test="celda-t-1"]').attributes('disabled')).toBeUndefined()
})

test('SESION_CAMBIADA se muestra con un mensaje claro', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  useCalificacionStore().finalizar = vi.fn(async () => {
    throw Object.assign(new Error('La sesión de esta pestaña cambió de jurado.'), { status: 0, motivo: 'SESION_CAMBIADA', errors: [] })
  })
  const w = await montar()
  await w.get('[data-test="enviar-final"]').trigger('click')
  await w.get('[data-test="confirmar-final"]').trigger('click')
  await flushPromises()
  const alerta = w.get('[data-test="error"]')
  expect(alerta.text()).toContain('cambió de jurado')
  expect(alerta.text()).toContain('Vuelve a entrar')
})

test('filas rechazadas muestran el nombre y el motivo; el estado por fila se ve en la matriz', async () => {
  const cola = useCalificacionStore()
  cola.rechazadas = { k: { motivo: 'PUNTAJE_FUERA_DE_RANGO', message: 'Puntaje fuera de rango' } }
  cola.estados = { t: 'SIN_CONEXION', k: 'ERROR' }
  const w = await montar()
  expect(w.get('[data-test="rechazadas"]').text()).toContain('Kira')
  expect(w.get('[data-test="rechazadas"]').text()).toContain('Puntaje fuera de rango')
  expect(w.get('[data-test="estado-t"]').text()).toBe('Sin conexión')
  expect(w.get('[data-test="estado-k"]').text()).toBe('No guardado')
})

test('la vista del jurado no muestra datos del responsable en ninguna parte', async () => {
  respuesta.filas[0].participante = { ...toby, responsable_primer_nombre: 'Ana' }
  const w = await montar()
  expect(w.text()).not.toContain('Ana')
})

const diferida = () => {
  let resolver
  const promesa = new Promise((r) => { resolver = r })
  return { promesa, resolver }
}

test('una recarga pedida antes de editar no pisa la celda ya escrita/guardada (última escritura local gana)', async () => {
  const w = await montar()
  const lenta = diferida()
  const vieja = matrizBase() // borrador del servidor anterior a la edición: { 1: 5, 2: null }
  trk.get.mockImplementation(async (url) => {
    if (url === '/jurado/matriz') return lenta.promesa
    throw new Error(`GET inesperado ${url}`)
  })
  tiempoReal.opciones.eventos['foto:nueva']({})
  await w.get('[data-test="celda-t-2"]').setValue('3')
  useCalificacionStore().estados = { t: 'GUARDADO' }
  lenta.resolver({ data: vieja })
  await flushPromises()
  expect(w.get('[data-test="celda-t-2"]').element.value).toBe('3')
  expect(w.get('[data-test="total-t"]').text()).toBe('8')
})

test('una respuesta pedida después de la edición sí se aplica', async () => {
  const w = await montar()
  await w.get('[data-test="celda-t-2"]').setValue('3')
  respuesta = matrizBase()
  respuesta.filas[0].borrador = { 1: 6, 2: 4 }
  tiempoReal.opciones.eventos['foto:nueva']({})
  await flushPromises()
  expect(w.get('[data-test="celda-t-1"]').element.value).toBe('6')
})

test('cambio rápido de categoría: la respuesta lenta de la primera se descarta', async () => {
  const w = await montar()
  const lenta = diferida()
  const felinos = { categoria: { ...CATS[1] }, categorias: CATS, criterios: CRITERIOS, puntaje_total_max: 17,
    filas: [{ participante: { id: 'g', mascota_nombre: 'Garfield', estado: 'PRESENTADO', categoria_id: 3 }, borrador: {}, final: { ...SIN_FINAL } }] }
  trk.get.mockImplementation(async (url, o) => {
    if (url !== '/jurado/matriz') throw new Error(`GET inesperado ${url}`)
    return o.params.categoria === 3 ? lenta.promesa : { data: matrizBase() }
  })
  await w.get('[data-test="selector-categoria"]').setValue('3')
  await w.get('[data-test="selector-categoria"]').setValue('1')
  await flushPromises()
  lenta.resolver({ data: felinos })
  await flushPromises()
  expect(w.get('[data-test="selector-categoria"]').element.value).toBe('1')
  expect(w.find('[data-test="fila-g"]').exists()).toBe(false)
  expect(w.find('[data-test="fila-t"]').exists()).toBe(true)
})

test('la barra fija queda sobre las celdas sticky y el diálogo sobre la barra', async () => {
  respuesta.filas[0].borrador = { 1: 4, 2: 4 }
  const w = await montar()
  const barra = w.get('[data-test="enviar-final"]').element.parentElement
  expect(barra.classList.contains('z-20')).toBe(true)
  await w.get('[data-test="enviar-final"]').trigger('click')
  expect(w.get('[data-test="confirmacion"]').classes()).toContain('z-30')
})
