<script setup>
import { computed } from 'vue'
import { useEventoStore } from '@/stores/evento'
import { useTiempoReal } from '@/composables/useTiempoReal'
import FotoMascota from '@/components/FotoMascota.vue'
import PodioRanking from '@/components/PodioRanking.vue'
import PortadaEvento from '@/components/PortadaEvento.vue'
import { LOGO, ALT_LOGO } from '@/utils/marca'

const evento = useEventoStore()
const p = computed(() => evento.enPasarela)
// En espera la portada ya muestra el logo grande: la cabecera solo lo repite cuando hay contenido
const enEspera = computed(() => evento.modoPantalla === 'PASARELA' ? !p.value : !(evento.modoPantalla === 'RANKING' && evento.ranking))

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
  <main class="flex min-h-screen flex-col bg-morado-900 p-6 text-crema">
    <header v-if="!enEspera" class="mb-4 flex items-center justify-between">
      <img :src="LOGO" :alt="ALT_LOGO" class="h-20 w-auto rounded-2xl shadow-lg" />
      <span v-if="p && evento.modoPantalla === 'PASARELA'" class="text-3xl font-bold text-calabaza-300">🎃 En pasarela</span>
    </header>

    <section v-if="evento.modoPantalla === 'PASARELA'" class="flex flex-1 items-center justify-center">
      <div v-if="p" class="grid w-full max-w-6xl items-center gap-8 md:grid-cols-2">
        <FotoMascota :participante="p" clase="aspect-[4/5] w-full max-h-[80vh] rounded-3xl shadow-2xl" />
        <div class="flex flex-col gap-4 text-center md:text-left">
          <h1 class="text-6xl font-extrabold md:text-7xl">{{ p.mascota_nombre }}</h1>
          <p v-if="p.disfraz_nombre" class="text-4xl text-calabaza-300">«{{ p.disfraz_nombre }}»</p>
          <p v-if="p.categoria" class="text-3xl text-morado-100">{{ p.categoria.nombre }}</p>
        </div>
      </div>
      <PortadaEvento v-else />
    </section>

    <section v-else-if="evento.modoPantalla === 'RANKING' && evento.ranking" class="mx-auto w-full max-w-6xl">
      <h1 class="mb-6 text-center text-5xl font-extrabold">🏆 {{ evento.ranking.categoria.nombre }}</h1>
      <PodioRanking :ranking="evento.ranking" grande />
    </section>
    <section v-else class="flex flex-1 items-center justify-center">
      <PortadaEvento />
    </section>
  </main>
</template>
