<script setup>
import { computed } from 'vue'

const props = defineProps({
  criterio: { type: Object, required: true },
  modelValue: { type: Number, default: null },
  deshabilitado: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const max = computed(() => props.criterio.puntaje_max)
const tocado = computed(() => props.modelValue !== null && props.modelValue !== undefined)
const fijar = (v) => emit('update:modelValue', Math.min(Math.max(Math.round(Number(v)), 0), max.value))
const menos = () => fijar(tocado.value ? props.modelValue - 1 : 0)
const mas = () => fijar(tocado.value ? props.modelValue + 1 : 1)
</script>

<template>
  <div class="tarjeta flex flex-col gap-2" :class="tocado ? '' : 'border-2 border-dashed border-calabaza-300'">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-lg font-bold">{{ criterio.nombre }}</h3>
      <span class="text-2xl font-extrabold tabular-nums" :class="tocado ? 'text-morado-800' : 'text-gray-400'">{{ tocado ? modelValue : '—' }} / {{ max }}</span>
    </div>
    <p class="text-sm text-morado-600">{{ criterio.descripcion }}</p>
    <div class="flex items-center gap-2">
      <button type="button" data-test="menos" class="btn min-w-tactil bg-morado-100 text-2xl text-morado-900" :disabled="deshabilitado" :aria-label="`Restar a ${criterio.nombre}`" @click="menos">−</button>
      <input
        type="range" min="0" :max="max" step="1" class="h-11 flex-1 accent-calabaza-600"
        :class="tocado ? '' : 'opacity-40'" :value="tocado ? modelValue : 0" :disabled="deshabilitado"
        :aria-label="criterio.nombre" :aria-valuetext="tocado ? `${modelValue} de ${max}` : 'sin calificar'"
        @input="fijar($event.target.value)"
      />
      <button type="button" data-test="mas" class="btn min-w-tactil bg-morado-100 text-2xl text-morado-900" :disabled="deshabilitado" :aria-label="`Sumar a ${criterio.nombre}`" @click="mas">+</button>
    </div>
  </div>
</template>
