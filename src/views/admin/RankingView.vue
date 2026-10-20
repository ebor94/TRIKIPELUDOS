<script setup>
import { ref, computed, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCategoriasStore } from '@/stores/categorias'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import { descargarBlob } from '@/utils/descargas'

const auth = useAuthStore()
const categorias = useCategoriasStore()
const categoriaId = ref(null)
const ranking = ref(null)
const puestos = ref(3)
const ordenEmpate = ref({})
const abiertas = ref(new Set())
const error = ref('')
const aviso = ref('')
const recienPublicada = ref(false)

const categoria = computed(() => (ranking.value ? ranking.value.categoria : null))
const filaPorId = (id) => ranking.value?.filas.find((f) => f.participante_id === id)
// Los puestos premiados solo vienen del servidor en la carga inicial y al cambiar de categoría; un refresco en segundo plano no los pisa.
let tomarPuestos = true
const mismoConjunto = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

// Conserva el orden local de cada grupo cuyos participantes no cambiaron; los demás toman el orden del servidor.
function conservarOrden(grupos) {
  const locales = Object.values(ordenEmpate.value)
  return Object.fromEntries(grupos.map((g, i) => {
    const local = locales.find((l) => mismoConjunto(l, g))
    return [i, [...(local ?? g)]]
  }))
}

async function cargar() {
  const id = categoriaId.value
  if (!id) return
  try {
    const datos = (await trk.get(`/ranking/${id}`)).data
    if (categoriaId.value !== id) return
    ranking.value = datos
    if (tomarPuestos) { puestos.value = datos.categoria.puestos_premiados; tomarPuestos = false }
    ordenEmpate.value = conservarOrden(datos.empates_sin_resolver)
  } catch (e) { if (categoriaId.value === id) error.value = mensajeDeError(e) }
}

async function accion(fn, exito) {
  error.value = ''
  aviso.value = ''
  try {
    await fn()
    if (exito) aviso.value = exito
    await cargar()
  } catch (e) { error.value = mensajeDeError(e) }
}

const elegir = (id) => { categoriaId.value = id; recienPublicada.value = false; tomarPuestos = true; cargar() }
const abrirCerrar = () => accion(() => trk.post(`/categorias/${categoriaId.value}/${categoria.value.abierta ? 'cerrar' : 'abrir'}`))
const guardarPuestos = () => accion(() => trk.patch(`/categorias/${categoriaId.value}`, { puestos_premiados: Number(puestos.value) }), 'Puestos premiados actualizados')
const publicar = () => {
  const advertencia = ranking.value.empates_sin_resolver.length ? ' Hay empates sin resolver.' : ''
  if (!window.confirm(`¿Publicar el ranking de esta categoría? Se verá en la pantalla pública y para el comentarista.${advertencia}`)) return
  return accion(async () => { await trk.post(`/categorias/${categoriaId.value}/publicar`); recienPublicada.value = true }, 'Ranking publicado')
}
const mostrarEnPantalla = () => accion(() => trk.put('/evento/pantalla', { modo: 'RANKING', categoria_id: categoriaId.value }), 'La pantalla muestra este ranking')
const desbloquear = (cal) => accion(() => trk.post(`/calificaciones/${cal.id}/desbloquear`), `Calificación de ${cal.jurado_nombre} desbloqueada`)
const guardarDesempate = (i) => accion(() => trk.put(`/ranking/${categoriaId.value}/desempate`, { orden: ordenEmpate.value[i] }), 'Desempate guardado')

function moverEmpate(i, id, paso) {
  const lista = [...ordenEmpate.value[i]]
  const a = lista.indexOf(id)
  const b = a + paso
  if (b < 0 || b >= lista.length) return
  ;[lista[a], lista[b]] = [lista[b], lista[a]]
  ordenEmpate.value = { ...ordenEmpate.value, [i]: lista }
}

function alternarDetalle(id) {
  const s = new Set(abiertas.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  abiertas.value = s
}

async function exportar() {
  try { descargarBlob(await trk.get('/export/resultados.xlsx', { responseType: 'blob' }), 'trikipeludos-resultados.xlsx') } catch (e) { error.value = mensajeDeError(e) }
}

useTiempoReal({ token: auth.token, sincronizar: cargar, intervaloMs: 10000, eventos: { 'calificacion:recibida': cargar } })
onMounted(async () => {
  try {
    await categorias.cargar(true)
    if (categorias.lista.length) elegir(categorias.lista[0].id)
  } catch (e) { error.value = mensajeDeError(e) }
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold">Ranking en vivo</h2>
      <button class="btn-claro" data-test="exportar" @click="exportar">⬇️ Exportar Excel</button>
    </div>
    <nav class="flex gap-1 overflow-x-auto">
      <button v-for="c in categorias.lista" :key="c.id" class="btn whitespace-nowrap" :class="c.id === categoriaId ? 'bg-calabaza-700 text-white' : 'bg-white text-morado-800'" @click="elegir(c.id)">{{ c.nombre }}</button>
    </nav>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">{{ aviso }}</p>

    <template v-if="ranking">
      <div class="tarjeta flex flex-wrap items-end gap-3">
        <span class="font-semibold">{{ categoria.abierta ? '🟢 Abierta' : '🔴 Cerrada' }} · {{ categoria.ranking_publicado ? 'Publicada' : 'Sin publicar' }}</span>
        <button class="btn-claro" data-test="cerrar" @click="abrirCerrar">{{ categoria.abierta ? 'Cerrar categoría' : 'Reabrir categoría' }}</button>
        <label class="flex items-center gap-2">Puestos premiados
          <input v-model="puestos" data-test="puestos" type="number" min="1" max="20" class="campo w-20" />
        </label>
        <button class="btn-claro" data-test="guardar-puestos" @click="guardarPuestos">Guardar</button>
        <button class="btn-primario" data-test="publicar" @click="publicar">Publicar</button>
        <button class="btn-secundario" data-test="mostrar-pantalla" :disabled="!categoria.ranking_publicado && !recienPublicada" @click="mostrarEnPantalla">Mostrar en pantalla</button>
      </div>

      <div v-if="ranking.empates_sin_resolver.length" data-test="empates" class="tarjeta border-2 border-calabaza-500">
        <h3 class="font-bold">⚖️ Empates sin resolver</h3>
        <p class="text-sm">Ordena de mejor a peor y guarda. Esto define el desempate manual (R5).</p>
        <div v-for="(grupo, i) in ordenEmpate" :key="i" class="mt-2 flex flex-col gap-1">
          <div v-for="id in grupo" :key="id" data-test="fila-empate" class="flex items-center gap-2">
            <span class="flex-1">{{ filaPorId(id)?.mascota_nombre }}</span>
            <button class="btn min-w-tactil" :data-test="`subir-empate-${id}`" :aria-label="`Subir ${filaPorId(id)?.mascota_nombre}`" @click="moverEmpate(i, id, -1)">▲</button>
            <button class="btn min-w-tactil" :data-test="`bajar-empate-${id}`" :aria-label="`Bajar ${filaPorId(id)?.mascota_nombre}`" @click="moverEmpate(i, id, 1)">▼</button>
          </div>
          <button class="btn-primario self-start" data-test="guardar-desempate" @click="guardarDesempate(i)">Guardar desempate</button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="bg-morado-50">
            <tr><th class="p-2">#</th><th class="p-2">Mascota</th><th class="p-2">Final</th><th v-for="c in ranking.criterios" :key="c.codigo" class="p-2">{{ c.nombre }}</th><th class="p-2">Estado</th><th class="p-2"></th></tr>
          </thead>
          <tbody>
            <template v-for="f in ranking.filas" :key="f.participante_id">
              <tr :class="f.premiado ? 'bg-calabaza-50' : ''" class="border-t border-morado-100">
                <td class="p-2 font-bold">{{ f.puesto ?? '—' }}<span v-if="f.empate_sin_resolver" title="Empate sin resolver"> ⚖️</span></td>
                <td class="p-2">{{ f.mascota_nombre }}</td>
                <td class="p-2 font-semibold">{{ f.puntaje_final ?? '—' }}</td>
                <td v-for="c in ranking.criterios" :key="c.codigo" class="p-2">{{ f.promedios[c.codigo] ?? '—' }}</td>
                <td class="p-2">{{ f.completa ? 'Completa' : `Incompleta (${f.n_calificaciones}/${f.n_jurados})` }}</td>
                <td class="p-2"><button class="btn text-morado-700" :data-test="`detalle-${f.participante_id}`" @click="alternarDetalle(f.participante_id)">Jurados</button></td>
              </tr>
              <tr v-if="abiertas.has(f.participante_id)">
                <td :colspan="5 + ranking.criterios.length" class="bg-morado-50 p-2">
                  <p v-if="!f.calificaciones.length">Sin calificaciones.</p>
                  <div v-for="cal in f.calificaciones" :key="cal.id" class="flex items-center gap-2 py-1">
                    <span class="flex-1">{{ cal.jurado_nombre }}: <strong>{{ cal.total }}</strong> {{ cal.bloqueada ? '🔒' : '🔓' }}</span>
                    <button v-if="cal.bloqueada" class="btn-claro" :data-test="`desbloquear-${cal.id}`" @click="desbloquear(cal)">Desbloquear</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
