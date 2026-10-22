<script setup>
// Podio de la pantalla pública según el diseño del evento: 2º · 1º · 3º con trofeo, foto, nombre y puntaje.
// Coordenadas en px del escenario de 2000×1125 (ver PantallaView).
import { computed } from 'vue'
import FotoMascota from './FotoMascota.vue'
import { TROFEO } from '@/utils/marca'

const props = defineProps({ ranking: { type: Object, required: true } })
const premiados = computed(() => props.ranking.filas.filter((f) => f.premiado).sort((a, b) => a.puesto - b.puesto))
const COLUMNA_X = { 2: 392, 1: 806, 3: 1219 }
const podio = computed(() => {
  const [primero, segundo, tercero] = premiados.value
  return [segundo, primero, tercero].filter(Boolean)
})
const resto = computed(() => premiados.value.slice(3))
</script>

<template>
  <div data-test="podio">
    <article
      v-for="f in podio" :key="f.participante_id" :data-puesto="f.puesto"
      class="absolute flex w-[390px] flex-col items-center" :style="{ left: `${COLUMNA_X[f.puesto]}px`, top: '318px' }"
    >
      <img data-test="trofeo" :src="TROFEO[f.puesto]" :alt="`${f.puesto}º lugar`" class="h-[118px] w-auto drop-shadow-lg" />
      <FotoMascota :participante="f.participante" clase="mt-[11px] h-[488px] w-[390px] rounded-[22px] border-4 border-morado-900 bg-black shadow-2xl" />
      <h2 class="contorno-blanco mt-3 max-w-[420px] truncate font-nombre text-[56px] font-bold leading-tight text-[#8E2BD6]">{{ f.mascota_nombre }}</h2>
      <p class="contorno-blanco font-cartel text-[62px] leading-none text-[#2a1206]">{{ f.puntaje_final }}</p>
    </article>
    <p v-if="resto.length" class="contorno-oscuro absolute bottom-[18px] left-0 right-0 text-center font-cartel text-[34px] text-calabaza-300">
      <span v-for="f in resto" :key="f.participante_id" class="mx-4">{{ f.puesto }}º {{ f.mascota_nombre }} · {{ f.puntaje_final }}</span>
    </p>
  </div>
</template>
