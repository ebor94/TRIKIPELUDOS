<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import draggable from 'vuedraggable'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useEventoStore } from '@/stores/evento'
import { useCategoriasStore } from '@/stores/categorias'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FichaMascota from '@/components/FichaMascota.vue'
import FotoMascota from '@/components/FotoMascota.vue'
import EstadoChip from '@/components/EstadoChip.vue'
import PodioRanking from '@/components/PodioRanking.vue'

const auth = useAuthStore()
const evento = useEventoStore()
const categorias = useCategoriasStore()
const categoriaId = ref(null)
const cola = ref([])
const indice = ref(0)
const error = ref('')
const llamando = ref(false)
const rankingPublicado = ref(null)
const mensajeRanking = ref('')
const viendoRanking = ref(false)
let recarga = null

const actual = computed(() => cola.value[indice.value] || null)

async function cargarCola() {
  if (!categoriaId.value) return
  try {
    const idActual = actual.value && actual.value.id
    cola.value = (await trk.get('/participantes', { params: { categoria: categoriaId.value } })).data
    const i = cola.value.findIndex((p) => p.id === idActual)
    indice.value = i >= 0 ? i : 0
  } catch (e) { error.value = mensajeDeError(e) }
}
onBeforeUnmount(() => clearTimeout(recarga))
// Reemplaza la lista conservando la mascota seleccionada (por id).
function fijarCola(lista) {
  const id = actual.value && actual.value.id
  cola.value = lista
  const i = lista.findIndex((p) => p.id === id)
  if (i >= 0) indice.value = i
}
const recargarPronto = () => { clearTimeout(recarga); recarga = setTimeout(cargarCola, 300) }

async function verRanking() {
  viendoRanking.value = !viendoRanking.value
  if (!viendoRanking.value) return
  rankingPublicado.value = null
  mensajeRanking.value = ''
  try {
    rankingPublicado.value = (await trk.get(`/ranking/${categoriaId.value}`)).data
  } catch (e) { mensajeRanking.value = mensajeDeError(e) }
}

function elegirCategoria(id) {
  categoriaId.value = id
  indice.value = 0
  cargarCola()
}

const mover = (paso) => { indice.value = Math.min(Math.max(indice.value + paso, 0), cola.value.length - 1) }

async function llamar() {
  if (!actual.value) return
  llamando.value = true
  error.value = ''
  try {
    const { data } = await trk.post(`/pasarela/${actual.value.id}`)
    cola.value = cola.value.map((p) => (p.id === data.id ? { ...p, ...data } : (p.estado === 'EN_PASARELA' ? { ...p, estado: 'PRESENTADO' } : p)))
    evento.alCambioPasarela({ participante: data })
  } catch (e) { error.value = mensajeDeError(e) } finally { llamando.value = false }
}

async function guardarOrden(nuevo) {
  try {
    fijarCola((await trk.put('/pasarela/orden', { categoria_id: categoriaId.value, orden: nuevo.map((p) => p.id) })).data)
  } catch (e) {
    error.value = mensajeDeError(e)
    cargarCola()
  }
}

function desplazar(id, paso) {
  const lista = [...cola.value]
  const i = lista.findIndex((p) => p.id === id)
  const j = i + paso
  if (i < 0 || j < 0 || j >= lista.length) return
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  fijarCola(lista)
  guardarOrden(lista)
}

useTiempoReal({
  token: auth.token,
  sincronizar: () => evento.sincronizar(),
  eventos: {
    'pasarela:cambio': (m) => { evento.alCambioPasarela(m); recargarPronto() },
    'participante:actualizado': recargarPronto,
    'foto:nueva': recargarPronto
  }
})

onMounted(async () => {
  try {
    await categorias.cargar()
    if (categorias.lista.length) elegirCategoria(categorias.lista[0].id)
  } catch (e) { error.value = mensajeDeError(e) }
})
</script>

<template>
  <div class="min-h-screen pb-28">
    <BarraSuperior titulo="Comentarista" />
    <nav class="flex gap-1 overflow-x-auto bg-white px-2 py-1 shadow-sm">
      <button v-for="c in categorias.lista" :key="c.id" class="btn whitespace-nowrap" :class="c.id === categoriaId ? 'bg-calabaza-700 text-white' : 'text-morado-800'" @click="elegirCategoria(c.id)">{{ c.nombre }}</button>
      <button class="btn whitespace-nowrap bg-morado-700 text-white" data-test="ver-ranking" @click="verRanking">🏆 Ranking</button>
    </nav>
    <section v-if="viendoRanking" class="mx-auto max-w-5xl p-4">
      <p v-if="mensajeRanking" class="tarjeta text-2xl">{{ mensajeRanking }}</p>
      <div v-else-if="rankingPublicado" class="tarjeta"><PodioRanking :ranking="rankingPublicado" grande /></div>
    </section>
    <main class="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[2fr_1fr]">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800 md:col-span-2" role="alert">{{ error }}</p>

      <section v-if="actual" data-test="ficha" class="tarjeta flex flex-col gap-3">
        <div class="flex items-center justify-between"><EstadoChip :estado="actual.estado" grande /><span class="text-2xl">{{ indice + 1 }} / {{ cola.length }}</span></div>
        <FichaMascota :participante="actual" grande />
        <div class="grid grid-cols-2 gap-2">
          <button class="btn-claro min-h-[56px] text-2xl" data-test="anterior" :disabled="indice === 0" @click="mover(-1)">◀ Anterior</button>
          <button class="btn-claro min-h-[56px] text-2xl" data-test="siguiente" :disabled="indice >= cola.length - 1" @click="mover(1)">Siguiente ▶</button>
        </div>
      </section>
      <p v-else class="tarjeta text-2xl">No hay mascotas presentes en esta categoría.</p>

      <aside class="tarjeta">
        <h2 class="mb-2 text-xl font-bold">Cola de salida</h2>
        <draggable :model-value="cola" item-key="id" handle=".asa" @update:model-value="(l) => { fijarCola(l); guardarOrden(l) }">
          <template #item="{ element, index }">
            <div class="flex items-center gap-1 border-b border-morado-100 py-2" :class="index === indice ? 'bg-calabaza-50' : ''">
              <span class="asa inline-flex min-h-tactil min-w-tactil cursor-grab touch-none select-none items-center justify-center text-xl" aria-hidden="true">⠿</span>
              <button class="flex min-h-tactil min-w-0 flex-1 items-center gap-2 text-left" @click="indice = index">
                <FotoMascota :participante="element" clase="h-12 w-10 shrink-0 rounded-lg" />
                <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span class="w-full truncate font-semibold">{{ element.mascota_nombre }}</span>
                  <EstadoChip :estado="element.estado" />
                </span>
              </button>
              <div class="flex shrink-0 flex-col">
                <button class="btn min-w-tactil px-2" :aria-label="`Subir ${element.mascota_nombre}`" :data-test="`subir-${element.id}`" @click="desplazar(element.id, -1)">▲</button>
                <button class="btn min-w-tactil px-2" :aria-label="`Bajar ${element.mascota_nombre}`" :data-test="`bajar-${element.id}`" @click="desplazar(element.id, 1)">▼</button>
              </div>
            </div>
          </template>
        </draggable>
      </aside>
    </main>

    <div v-if="actual" class="fixed inset-x-0 bottom-0 bg-white/95 p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <button class="btn-primario mx-auto flex min-h-[64px] w-full max-w-xl text-2xl" data-test="llamar" :disabled="llamando || actual.estado === 'EN_PASARELA'" @click="llamar">
        {{ actual.estado === 'EN_PASARELA' ? 'En pasarela' : '📣 Llamar a pasarela' }}
      </button>
    </div>
  </div>
</template>
