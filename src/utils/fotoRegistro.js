// Foto del formulario de inscripción (columna FOTOGRAFÍA PARTICIPANTE del CSV). Suele ser un enlace de
// Google Drive a una página, no a una imagen: se convierte a la miniatura de Drive, que se puede mostrar
// en <img> si el archivo está compartido como "cualquier persona con el enlace". Solo para que cabina
// constate la mascota; en pasarela, pantalla y jurados se usa la foto oficial que sube cabina.
const ID_DRIVE = [/\/file\/d\/([\w-]+)/, /[?&]id=([\w-]+)/]

export function urlFotoRegistro(url) {
  if (typeof url !== 'string') return null
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return null
  if (/(^|\.)drive\.google\.com\//i.test(u.replace(/^https?:\/\//i, ''))) {
    for (const re of ID_DRIVE) {
      const m = u.match(re)
      if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`
    }
    return null
  }
  return u
}
