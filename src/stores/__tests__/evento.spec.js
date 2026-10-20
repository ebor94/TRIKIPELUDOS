import { test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api', () => ({ api: {}, trk: { get: vi.fn() }, tokenStorage: { leer: () => null, guardar: () => {} } }))

import { trk } from '@/services/api'
import { useEventoStore } from '@/stores/evento'

beforeEach(() => setActivePinia(createPinia()))

test('sincronizar aplica el estado público', async () => {
  trk.get.mockResolvedValue({ data: { modo_pantalla: 'PASARELA', categoria_pantalla: null, en_pasarela: { id: 'a' }, ranking: null } })
  const e = useEventoStore()
  await e.sincronizar()
  expect(trk.get).toHaveBeenCalledWith('/evento/estado')
  expect(e.enPasarela).toEqual({ id: 'a' })
})

test('cambio de pasarela y foto nueva del que está en pasarela', () => {
  const e = useEventoStore()
  e.alCambioPasarela({ participante: { id: 'b', foto_url: null } })
  e.alFotoNueva({ participante: { id: 'c', foto_url: '/x.jpg' } })
  expect(e.enPasarela.foto_url).toBeNull()
  e.alFotoNueva({ participante: { id: 'b', foto_url: '/y.jpg' } })
  expect(e.enPasarela.foto_url).toBe('/y.jpg')
})
