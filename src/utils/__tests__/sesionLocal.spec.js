import { test, expect } from 'vitest'
import { idDelToken } from '@/utils/sesionLocal'

const b64url = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwtDe = (payload) => `h.${b64url(payload)}.f`

test('idDelToken lee el id del payload del JWT (base64url)', () => {
  expect(idDelToken(jwtDe({ id: 7, scope: 'trk', tv: 1 }))).toBe(7)
  expect(idDelToken(jwtDe({ id: 'abc', nombre: 'Ñandú ~~~ ???' }))).toBe('abc')
})

test('idDelToken devuelve null con tokens ausentes o mal formados', () => {
  expect(idDelToken(null)).toBeNull()
  expect(idDelToken('t')).toBeNull()
  expect(idDelToken('a.!!!.c')).toBeNull()
  expect(idDelToken(jwtDe({ sub: 1 }))).toBeNull()
})
