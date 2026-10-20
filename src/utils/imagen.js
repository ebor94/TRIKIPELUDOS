// HU-5 CA3: recorte 4:5, lado mayor ≤ 1600 px, JPEG ~0.8, objetivo < 500 KB.
const RELACION = 4 / 5

export function calcularRecorte45(ancho, alto) {
  if (ancho / alto > RELACION) {
    const sw = Math.round(alto * RELACION)
    return { sx: Math.round((ancho - sw) / 2), sy: 0, sw, sh: alto }
  }
  const sh = Math.round(ancho / RELACION)
  return { sx: 0, sy: Math.round((alto - sh) / 2), sw: ancho, sh }
}

export function dimensionesDestino(sw, sh, ladoMax = 1600) {
  const escala = Math.min(1, ladoMax / Math.max(sw, sh))
  return { ancho: Math.round(sw * escala), alto: Math.round(sh * escala) }
}

const aBlob = (canvas, calidad) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/jpeg', calidad)
})

export async function comprimirImagen(archivo, { ladoMax = 1600, calidad = 0.8, objetivoBytes = 500 * 1024, calidadMinima = 0.5 } = {}) {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const { sx, sy, sw, sh } = calcularRecorte45(bitmap.width, bitmap.height)
  const { ancho, alto } = dimensionesDestino(sw, sh, ladoMax)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, ancho, alto)
  if (bitmap.close) bitmap.close()

  let q = calidad
  let blob = await aBlob(canvas, q)
  while (blob.size > objetivoBytes && q - 0.1 >= calidadMinima - 1e-9) {
    q = Math.round((q - 0.1) * 10) / 10
    blob = await aBlob(canvas, q)
  }
  return blob
}
