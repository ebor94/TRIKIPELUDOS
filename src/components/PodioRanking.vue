<script setup>
import { computed } from 'vue'
import FotoMascota from './FotoMascota.vue'

const props = defineProps({ ranking: { type: Object, required: true }, grande: { type: Boolean, default: false } })
const premiados = computed(() => props.ranking.filas.filter((f) => f.premiado).sort((a, b) => a.puesto - b.puesto))
const podio = computed(() => {
  const [primero, segundo, tercero] = premiados.value
  return [segundo, primero, tercero].filter(Boolean)
})
const restoPremiados = computed(() => premiados.value.slice(3))
const ALTURA = { 1: 'md:mt-0', 2: 'md:mt-10', 3: 'md:mt-16' }
const MEDALLA = { 1: '🥇', 2: '🥈', 3: '🥉' }
</script>

<template>
  <div class="flex flex-col gap-6">
    <div data-test="podio" class="grid items-end gap-4 sm:grid-cols-3">
      <article v-for="f in podio" :key="f.participante_id" :data-puesto="f.puesto" :class="['flex flex-col items-center gap-2 text-center', ALTURA[f.puesto]]">
        <span :class="grande ? 'text-6xl' : 'text-4xl'">{{ MEDALLA[f.puesto] || f.puesto }}</span>
        <FotoMascota :participante="f.participante" :clase="`aspect-[4/5] w-full rounded-2xl ${f.puesto === 1 ? 'ring-4 ring-calabaza-400' : ''}`" />
        <h3 :class="['font-extrabold', grande ? 'text-4xl' : 'text-2xl']">{{ f.mascota_nombre }}</h3>
        <p :class="['font-bold text-calabaza-600', grande ? 'text-3xl' : 'text-xl']">{{ f.puntaje_final }}</p>
      </article>
    </div>
    <ol v-if="restoPremiados.length" class="flex flex-col gap-1">
      <li v-for="f in restoPremiados" :key="f.participante_id" class="text-xl">{{ f.puesto }}. {{ f.mascota_nombre }} — {{ f.puntaje_final }}</li>
    </ol>
    <table data-test="tabla" class="w-full text-left" :class="grande ? 'text-2xl' : 'text-base'">
      <thead><tr><th class="p-1">#</th><th class="p-1">Mascota</th><th class="p-1">Puntaje</th></tr></thead>
      <tbody>
        <tr v-for="f in ranking.filas" :key="f.participante_id" class="border-t border-white/10">
          <td class="p-1">{{ f.puesto ?? '—' }}</td>
          <td class="p-1">{{ f.mascota_nombre }}</td>
          <td class="p-1">{{ f.completa ? f.puntaje_final : 'Incompleta' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
