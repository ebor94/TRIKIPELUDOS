<script setup>
import { computed } from 'vue'
import FotoMascota from './FotoMascota.vue'

const props = defineProps({ participante: { type: Object, required: true }, grande: { type: Boolean, default: false } })
const SEXO = { MACHO: 'Macho', HEMBRA: 'Hembra' }
const t = computed(() => (props.grande
  ? { nombre: 'text-5xl', dato: 'text-2xl', disfraz: 'text-3xl' }
  : { nombre: 'text-2xl', dato: 'text-base', disfraz: 'text-lg' }))
const detalles = computed(() => [
  props.participante.raza,
  props.participante.edad_texto ? `${props.participante.edad_texto}` : null,
  SEXO[props.participante.sexo]
].filter(Boolean))
</script>

<template>
  <article class="flex flex-col gap-3">
    <FotoMascota :participante="participante" />
    <h2 data-texto :class="['font-extrabold leading-tight text-morado-800', t.nombre]">{{ participante.mascota_nombre }}</h2>
    <p v-if="participante.disfraz_nombre" data-texto :class="['font-semibold text-calabaza-800', t.disfraz]">«{{ participante.disfraz_nombre }}»</p>
    <p v-if="detalles.length" data-texto :class="t.dato">{{ detalles.join(' · ') }}</p>
    <p v-if="participante.categoria" data-texto :class="['text-morado-700', t.dato]">{{ participante.categoria.nombre }}</p>
    <p v-if="participante.responsable_primer_nombre" data-texto :class="t.dato">Con {{ participante.responsable_primer_nombre }}</p>
  </article>
</template>
