import 'fake-indexeddb/auto'

// Node ≥ 22 expone un localStorage global experimental (undefined sin --localstorage-file) que tapa el de jsdom.
// Se reemplaza por el de jsdom para que las pruebas usen un Storage real.
for (const nombre of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[nombre] === 'undefined' && globalThis.jsdom) {
    Object.defineProperty(globalThis, nombre, { value: globalThis.jsdom.window[nombre], configurable: true, writable: true })
  }
}
