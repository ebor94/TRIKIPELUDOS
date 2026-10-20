<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCalificacionStore } from '@/stores/calificacion'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import FotoMascota from '@/components/FotoMascota.vue'

const router = useRouter()
const auth = useAuthStore()
const evento = useEventoStore()
const cola = useCalificacionStore()
const galeria = ref([])
const mias = ref({})
const error = ref('')
let detenerSync = null

const CALIFICABLES = ['EN_PASARELA', 'PRESENTADO']
function insignia(p) {
  if (mias.value[p.id]) return ['Calificada', 'bg-green-100 text-green-900']
  if (cola.pendientes[p.id]) return ['Por sincronizar', 'bg-calabaza-100 text-calabaza-900']
  if (!CALIFICABLES.includes(p.estado)) return ['Aún no sale', 'bg-gray-200 text-gray-700']
  return ['Pendiente', 'bg-morado-100 text-morado-900']
}
const enPasarela = computed(() => evento.enPasarela)

async function cargar() {
  try {
    const [g, m] = await Promise.all([trk.get('/participantes'), trk.get('/calificaciones/mias')])
    galeria.value = g.data
    mias.value = Object.fromEntries(m.data.filter((c) => c.bloqueada).map((c) => [c.participante_id, c]))
  } catch (e) { error.value = mensajeDeError(e) }
}

const calificar = (id) => router.push(`/jurado/calificar/${id}`)

useTiempoReal({
  token: auth.token,
  sincronizar: async () => { await evento.sincronizar(); await cargar() },
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); cargar() },
    'foto:nueva': (m) => evento.alFotoNueva(m)
  }
})

onMounted(async () => {
  await cola.cargarPendientes(auth.usuario && auth.usuario.id)
  detenerSync = cola.iniciarAutoSincronizacion(auth.usuario && auth.usuario.id)
})
onBeforeUnmount(() => detenerSync && detenerSync())
</script>

<template>
  <div class="min-h-screen pb-8">
    <BarraSuperior titulo="Jurado" />
    <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

      <section v-if="enPasarela" data-test="en-pasarela" class="tarjeta flex flex-col gap-3 border-2 border-calabaza-500">
        <p class="text-sm font-bold uppercase text-calabaza-800">🎃 En pasarela ahora</p>
        <FichaMascota :participante="enPasarela" />
        <button v-if="!mias[enPasarela.id]" class="btn-primario min-h-[56px] text-xl" data-test="calificar-en-pasarela" @click="calificar(enPasarela.id)">Calificar</button>
        <p v-else class="text-center font-semibold text-green-800">Ya la calificaste ✅</p>
      </section>
      <p v-else class="tarjeta text-center">Aún no hay mascota en pasarela.</p>

      <h2 class="text-xl font-bold">Galería</h2>
      <ul class="grid grid-cols-2 gap-3">
        <li v-for="p in galeria" :key="p.id">
          <button class="tarjeta flex w-full flex-col gap-2 p-2 text-left disabled:opacity-60" :disabled="!CALIFICABLES.includes(p.estado)" @click="calificar(p.id)">
            <FotoMascota :participante="p" clase="aspect-[4/5] w-full rounded-xl" />
            <span class="font-semibold">{{ p.mascota_nombre }}</span>
            <span :data-test="`insignia-${p.id}`" :class="['self-start rounded-full px-2 py-0.5 text-xs font-semibold', insignia(p)[1]]">{{ insignia(p)[0] }}</span>
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
