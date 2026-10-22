<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCalificacionStore } from '@/stores/calificacion'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import { totalDe, completa, puestosTentativos, aLista, aMapa } from '@/utils/matriz'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import MatrizCalificacion from '@/components/MatrizCalificacion.vue'

const auth = useAuthStore()
const evento = useEventoStore()
const cola = useCalificacionStore()
const juradoId = computed(() => auth.usuario && auth.usuario.id)

const matriz = ref(null) // respuesta de TRK-CAL-004
const valores = ref({}) // participanteId → { criterioId: puntaje|null } (lo que el jurado ve y edita)
const categoriaElegida = ref(null) // null = seguir la categoría de quien está en pasarela (CA1)
const errorCarga = ref('')
const error = ref('')
const aviso = ref('')
const confirmando = ref(false)
const enviando = ref(false)
let detenerSync = null

const MENSAJE_SESION_CAMBIADA =
  'La sesión de esta pestaña cambió de jurado: no se envió nada. Vuelve a entrar con tu usuario antes de enviar la calificación final.'

// CA1/CA2: el jurado ve foto, nombre, disfraz y categoría; nunca datos del responsable.
const enPasarela = computed(() => (evento.enPasarela ? { ...evento.enPasarela, responsable_primer_nombre: null } : null))
const criterios = computed(() => (matriz.value ? matriz.value.criterios : []))
const filas = computed(() => (matriz.value ? matriz.value.filas : []).map((f) => {
  const esFinal = f.final && f.final.estado === 'FINAL'
  const v = esFinal ? f.final.puntajes : (valores.value[f.participante.id] || {})
  return { id: f.participante.id, participante: f.participante, valores: v, total: totalDe(v, criterios.value), completa: completa(v, criterios.value), esFinal }
}))
const puestos = computed(() => puestosTentativos(filas.value))
const pendientes = computed(() => filas.value.filter((f) => !f.esFinal))
const abierta = computed(() => Boolean(matriz.value && matriz.value.categoria && matriz.value.categoria.abierta))
const puedeEnviar = computed(() => abierta.value && !enviando.value && pendientes.value.length > 0 && pendientes.value.every((f) => f.completa))
const rankingTentativo = computed(() => filas.value.filter((f) => f.completa).sort((a, b) => b.total - a.total))
const rechazadas = computed(() => Object.entries(cola.rechazadas).map(([pid, r]) => ({
  pid, nombre: (filas.value.find((f) => f.id === pid) || { participante: {} }).participante.mascota_nombre || 'Una mascota', message: r.message
})))

// Lo local manda: una fila pendiente en IndexedDB o que se está guardando conserva lo que el jurado escribió.
function aplicarMatriz(data) {
  const nuevos = {}
  for (const f of data.filas) {
    const pid = f.participante.id
    const local = cola.pendientes[pid]
    if (local) nuevos[pid] = aMapa(local.puntajes)
    else if (cola.estados[pid] === 'GUARDANDO' && valores.value[pid]) nuevos[pid] = valores.value[pid]
    else nuevos[pid] = { ...f.borrador }
  }
  matriz.value = data
  valores.value = nuevos
}

async function cargar() {
  try {
    const params = categoriaElegida.value ? { categoria: categoriaElegida.value } : {}
    aplicarMatriz((await trk.get('/jurado/matriz', { params })).data)
    errorCarga.value = ''
  } catch (e) { errorCarga.value = mensajeDeError(e) }
}

function alCambiar({ participanteId, criterioId, valor }) {
  aviso.value = ''
  valores.value = { ...valores.value, [participanteId]: { ...(valores.value[participanteId] || {}), [criterioId]: valor } }
  cola.anotar(juradoId.value, participanteId, aLista(valores.value[participanteId], criterios.value))
    .catch((e) => { error.value = mensajeDeError(e) })
}

function elegirCategoria(id) {
  const dePasarela = evento.enPasarela && evento.enPasarela.categoria_id
  categoriaElegida.value = Number(id) === Number(dePasarela) ? null : Number(id)
  cargar()
}

async function confirmarEnvio() {
  enviando.value = true
  error.value = ''
  try {
    const r = await cola.finalizar(juradoId.value, matriz.value.categoria.id, pendientes.value.map((f) => f.id))
    aviso.value = `Calificación final enviada: ${r.calificaciones.length} mascota(s).`
    await cargar()
  } catch (e) {
    error.value = e && e.motivo === 'SESION_CAMBIADA' ? MENSAJE_SESION_CAMBIADA : mensajeDeError(e)
  } finally {
    confirmando.value = false
    enviando.value = false
  }
}

useTiempoReal({
  token: auth.token,
  sincronizar: async () => { await evento.sincronizar(); await cargar() },
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); cargar() },
    'foto:nueva': (m) => { evento.alFotoNueva(m); cargar() }
  }
})

onMounted(async () => {
  detenerSync = cola.iniciarAutoSincronizacion(juradoId.value)
  try {
    // Lo que quedó en IndexedDB (sin enviar) se muestra sobre lo del servidor y se reintenta de inmediato.
    await cola.cargarPendientes(juradoId.value)
    if (matriz.value) aplicarMatriz(matriz.value)
    cola.sincronizar(juradoId.value).catch(() => {})
  } catch (e) { error.value = mensajeDeError(e) }
})
onBeforeUnmount(() => detenerSync && detenerSync())
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Jurado" />
    <main class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <p v-if="error || errorCarga" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert" data-test="error">{{ error || errorCarga }}</p>
      <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status" data-test="aviso">{{ aviso }}</p>
      <div v-if="rechazadas.length" data-test="rechazadas" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">
        <p class="font-semibold">Puntajes no guardados (revisa la fila):</p>
        <ul class="list-disc pl-5">
          <li v-for="r in rechazadas" :key="r.pid"><strong>{{ r.nombre }}</strong>: {{ r.message }}</li>
        </ul>
      </div>

      <section v-if="enPasarela" data-test="en-pasarela" class="tarjeta flex flex-col gap-3 border-2 border-calabaza-500 sm:flex-row">
        <p class="text-sm font-bold uppercase text-calabaza-800">🎃 En pasarela ahora</p>
        <FichaMascota :participante="enPasarela" />
      </section>
      <p v-else class="tarjeta text-center">Aún no hay mascota en pasarela.</p>

      <label v-if="matriz" class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-morado-800">Categoría</span>
        <select class="campo" data-test="selector-categoria" :value="matriz.categoria ? matriz.categoria.id : ''" @change="elegirCategoria($event.target.value)">
          <option v-if="!matriz.categoria" value="" disabled>Elige una categoría</option>
          <option v-for="c in matriz.categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </label>

      <template v-if="matriz && matriz.categoria">
        <p v-if="!abierta" class="rounded-xl bg-red-100 p-3 text-red-800">La categoría está cerrada.</p>
        <p v-if="!filas.length" class="tarjeta text-center">Aún no desfila ninguna mascota de esta categoría.</p>
        <MatrizCalificacion
          v-else
          :criterios="criterios" :filas="filas" :puestos="puestos" :estados="cola.estados"
          :en-pasarela-id="evento.enPasarela ? evento.enPasarela.id : null" :deshabilitada="!abierta || enviando"
          @cambiar="alCambiar"
        />
      </template>
    </main>

    <div v-if="matriz && matriz.categoria" class="fixed inset-x-0 bottom-0 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <button class="btn-primario min-h-[56px] w-full text-lg" data-test="enviar-final" :disabled="!puedeEnviar" @click="confirmando = true">Enviar calificación final ({{ pendientes.length }})</button>
    </div>

    <div v-if="confirmando" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion" data-test="confirmacion" class="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div class="tarjeta flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-y-auto">
        <h2 id="titulo-confirmacion" class="text-xl font-bold">¿Enviar calificación final?</h2>
        <p>Se enviarán {{ pendientes.length }} mascota(s) de {{ matriz.categoria.nombre }}. Después no podrás modificarlas.</p>
        <ol class="flex flex-col gap-1">
          <li v-for="f in rankingTentativo" :key="f.id" class="flex justify-between gap-2">
            <span>{{ puestos[f.id] }}. {{ f.participante.mascota_nombre }}<template v-if="f.esFinal"> ✓</template></span>
            <span class="font-bold tabular-nums">{{ f.total }}</span>
          </li>
        </ol>
        <div class="flex gap-2">
          <button class="btn-claro min-h-tactil flex-1" :disabled="enviando" @click="confirmando = false">Cancelar</button>
          <button class="btn-primario min-h-tactil flex-1" data-test="confirmar-final" :disabled="enviando" @click="confirmarEnvio">Confirmar envío</button>
        </div>
      </div>
    </div>
  </div>
</template>
