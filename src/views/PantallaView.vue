<script setup>
import { computed } from 'vue'
import { useEventoStore } from '@/stores/evento'
import { useTiempoReal } from '@/composables/useTiempoReal'
import FotoMascota from '@/components/FotoMascota.vue'

const evento = useEventoStore()
const logo = import.meta.env.VITE_LOGO_URL || `${import.meta.env.BASE_URL}logo-evento.svg`
const p = computed(() => evento.enPasarela)

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
    <header class="mb-4 flex items-center justify-between">
      <img :src="logo" alt="TRIKIPELUDOS" class="h-16" />
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
      <img v-else data-test="logo" :src="logo" alt="TRIKIPELUDOS" class="w-full max-w-xl" />
    </section>

    <section v-else class="flex flex-1 items-center justify-center">
      <img data-test="logo" :src="logo" alt="TRIKIPELUDOS" class="w-full max-w-xl" />
    </section>
  </main>
</template>
