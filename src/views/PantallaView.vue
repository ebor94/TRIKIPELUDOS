<script setup>
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/lilita-one/latin-400.css'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useEventoStore } from '@/stores/evento'
import { useTiempoReal } from '@/composables/useTiempoReal'
import FotoMascota from '@/components/FotoMascota.vue'
import PodioPantalla from '@/components/PodioPantalla.vue'
import PortadaEvento from '@/components/PortadaEvento.vue'
import { LOGO_TEXTO, ALT_LOGO, FONDO_PANTALLA, PATROCINADORES, ALT_PATROCINADORES } from '@/utils/marca'

const evento = useEventoStore()
const p = computed(() => evento.enPasarela)
const enRanking = computed(() => evento.modoPantalla === 'RANKING' && !!evento.ranking)
const enPasarela = computed(() => evento.modoPantalla === 'PASARELA' && !!p.value)
const etiqueta = computed(() => (enRanking.value ? 'Ganadores' : enPasarela.value ? 'En pasarela' : null))

// El diseño está hecho sobre un lienzo de 2000×1125 (16:9): se escala para caber en cualquier TV o proyector.
const ANCHO = 2000
const ALTO = 1125
const escala = ref(1)
function ajustar() { escala.value = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO) }
onMounted(() => { ajustar(); window.addEventListener('resize', ajustar) })
onBeforeUnmount(() => window.removeEventListener('resize', ajustar))

// Nombres largos: se reduce la letra para que quepan en el ancho disponible (~1000 px del lienzo).
const tamanoNombre = computed(() => {
  const n = p.value && p.value.mascota_nombre ? p.value.mascota_nombre.length : 1
  return `${Math.round(Math.min(150, 1000 / (n * 0.6)))}px`
})

useTiempoReal({
  token: null,
  sincronizar: () => evento.sincronizar(),
  eventos: {
    'pasarela:cambio': (m) => evento.alCambioPasarela(m),
    'foto:nueva': (m) => evento.alFotoNueva(m),
    'pantalla:modo': (estado) => evento.aplicarEstado(estado),
    'ranking:publicado': () => evento.sincronizar()
  }
})
</script>

<template>
  <main
    data-test="pantalla"
    class="fixed inset-0 overflow-hidden bg-morado-900 bg-cover bg-center text-crema"
    :style="{ backgroundImage: `url(${FONDO_PANTALLA})` }"
  >
    <div
      class="absolute left-1/2 top-1/2"
      :style="{ width: `${ANCHO}px`, height: `${ALTO}px`, transform: `translate(-50%, -50%) scale(${escala})` }"
    >
      <img
        v-if="enPasarela || enRanking" data-test="logo-texto" :src="LOGO_TEXTO" :alt="ALT_LOGO"
        class="absolute left-[45px] top-[40px] w-[455px] drop-shadow-xl"
      />
      <p v-if="enRanking" data-test="categoria-ranking" class="contorno-oscuro absolute left-[35px] top-[195px] max-w-[560px] font-cartel text-[46px] leading-tight text-calabaza-400">{{ evento.ranking.categoria.nombre }}</p>
      <img data-test="patrocinadores" :src="PATROCINADORES" :alt="ALT_PATROCINADORES" class="absolute left-[628px] top-0 w-[812px]" />
      <div v-if="etiqueta" class="absolute right-[48px] top-[30px] flex items-center gap-3">
        <span class="text-[56px] leading-none" aria-hidden="true">🎃</span>
        <span data-test="etiqueta" class="contorno-oscuro rounded-xl border-2 border-calabaza-200/80 px-5 py-1 font-cartel text-[46px] leading-tight text-calabaza-400">{{ etiqueta }}</span>
      </div>

      <template v-if="enPasarela">
        <FotoMascota
          :participante="p"
          clase="absolute left-[378px] top-[345px] h-[615px] w-[494px] rounded-[22px] border-4 border-morado-900 bg-black shadow-2xl"
        />
        <div class="absolute left-[945px] top-[490px] flex max-w-[1010px] flex-col">
          <h1 class="contorno-blanco font-nombre font-bold leading-none text-[#8E2BD6]" :style="{ fontSize: tamanoNombre }">{{ p.mascota_nombre }}</h1>
          <p v-if="p.disfraz_nombre" class="contorno-blanco mt-3 font-cartel text-[84px] leading-none text-calabaza-500">&lt;{{ p.disfraz_nombre }}&gt;</p>
          <p v-if="p.categoria" class="contorno-blanco mt-5 font-cartel text-[44px] italic leading-none text-[#2a1206]">{{ p.categoria.nombre }}</p>
        </div>
      </template>

      <PodioPantalla v-else-if="enRanking" :ranking="evento.ranking" />

      <div v-else class="absolute inset-x-[160px] top-[330px] flex justify-center">
        <PortadaEvento />
      </div>
    </div>
  </main>
</template>
