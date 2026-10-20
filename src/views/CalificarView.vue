<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import ControlPuntaje from '@/components/ControlPuntaje.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useCalificacionStore()
const juradoId = computed(() => auth.usuario && auth.usuario.id)

const participante = ref(null)
const rubrica = ref(null)
const valores = ref({})
const enviada = ref(null)
const error = ref('')
const enviando = ref(false)
const encolada = ref(false)
let detenerSync = null
let desmontado = false

const total = computed(() => Object.values(valores.value).reduce((s, v) => s + (v ?? 0), 0))
const completos = computed(() => rubrica.value && rubrica.value.criterios.every((c) => valores.value[c.id] !== null && valores.value[c.id] !== undefined))
const pendiente = computed(() => encolada.value || Boolean(store.pendientes[route.params.id]))

async function cargar({ conservar = false } = {}) {
  try {
    participante.value = (await trk.get(`/participantes/${route.params.id}`)).data
    const [rub, mias] = await Promise.all([
      trk.get(`/rubricas/${participante.value.categoria_id}`),
      trk.get('/calificaciones/mias')
    ])
    rubrica.value = rub.data
    const previos = conservar ? valores.value : {}
    valores.value = Object.fromEntries(rub.data.criterios.map((c) => [c.id, previos[c.id] ?? null]))
    const previa = mias.data.find((c) => c.participante_id === route.params.id && c.bloqueada)
    if (previa) enviada.value = previa
  } catch (e) { error.value = mensajeDeError(e) }
}

async function enviar() {
  if (!completos.value) return
  if (!window.confirm(`¿Enviar ${total.value} / ${rubrica.value.puntaje_total_max} para ${participante.value.mascota_nombre}? Después no podrás modificarla.`)) return
  enviando.value = true
  error.value = ''
  const puntajes = rubrica.value.criterios.map((c) => ({ criterio_id: c.id, puntaje: valores.value[c.id] }))
  try {
    const r = await store.enviar(juradoId.value, route.params.id, puntajes)
    if (r.estado === 'ENVIADA') enviada.value = r.calificacion
    else if (r.estado === 'PENDIENTE') encolada.value = true
    else if (r.estado === 'RECHAZADA') error.value = mensajeDeError(r.error)
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally { enviando.value = false }
}

// Si la cola se vacía, recarga conservando los puntajes. Si el servidor no tiene la calificación
// (fue rechazada), el jurado ve el aviso y puede corregir y reenviar.
watch(() => store.pendientes[route.params.id], async (nuevo, previo) => {
  if (!previo || nuevo || desmontado) return
  encolada.value = false
  await cargar({ conservar: true })
  // Muestra el motivo del servidor (HU-8 CA5) y reemplaza cualquier error anterior.
  if (!enviada.value) {
    error.value = (store.rechazadas[route.params.id] || {}).message || 'La calificación pendiente no pudo registrarse; revisa los puntajes y vuelve a enviar.'
  }
})

onMounted(async () => {
  // La carga no espera a la cola local (IndexedDB) ni a la auto-sincronización.
  const carga = cargar()
  detenerSync = store.iniciarAutoSincronizacion(juradoId.value)
  await store.cargarPendientes(juradoId.value).catch(() => {})
  await carga
  const rechazo = store.rechazadas[route.params.id]
  if (rechazo && !enviada.value && !desmontado) error.value = rechazo.message
})
onBeforeUnmount(() => {
  desmontado = true
  if (detenerSync) detenerSync()
})
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Calificar" />
    <main class="mx-auto flex max-w-xl flex-col gap-3 p-4">
      <button class="btn-claro self-start" @click="router.push('/jurado')">◀ Volver</button>
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
      <FichaMascota v-if="participante" :participante="participante" />

      <p v-if="enviada" class="tarjeta border-2 border-green-600 text-center text-xl" role="status">
        ✅ Calificación enviada: <strong>{{ enviada.total }}<template v-if="rubrica"> / {{ rubrica.puntaje_total_max }}</template></strong><br />
        <span class="text-sm">Está bloqueada. Si necesitas corregirla, pide al administrador que la desbloquee.</span>
      </p>
      <p v-else-if="pendiente" class="tarjeta border-2 border-calabaza-500 text-center" role="status">
        ⏳ Pendiente de sincronizar. Se enviará sola cuando vuelva la conexión.
      </p>

      <template v-if="rubrica && !enviada && !pendiente">
        <p v-if="!rubrica.categoria.abierta" class="rounded-xl bg-red-100 p-3 text-red-800">La categoría está cerrada.</p>
        <ControlPuntaje v-for="c in rubrica.criterios" :key="c.id" v-model="valores[c.id]" :criterio="c" :deshabilitado="!rubrica.categoria.abierta" />
      </template>
    </main>

    <div v-if="rubrica && !enviada && !pendiente" class="fixed inset-x-0 bottom-0 flex items-center gap-3 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <span data-test="total" class="text-2xl font-extrabold tabular-nums">{{ total }} / {{ rubrica.puntaje_total_max }}</span>
      <button class="btn-primario min-h-[56px] flex-1 text-xl" data-test="enviar" :disabled="!completos || enviando || !rubrica.categoria.abierta" @click="enviar">Enviar</button>
    </div>
  </div>
</template>
