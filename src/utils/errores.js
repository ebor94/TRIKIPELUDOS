export function mensajeDeError(err) {
  if (!err) return 'Ocurrió un error'
  if (err.errors && err.errors.length) return err.errors.map((e) => e.mensaje).join('. ')
  return err.message || 'Ocurrió un error'
}
