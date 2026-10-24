<script setup>
import { computed } from 'vue'
import { estiloSolido, normalizarColor } from '@/utils/colorCategoria'

const props = defineProps({ categoria: { type: Object, default: null }, grande: { type: Boolean, default: false } })
const tieneColor = computed(() => Boolean(props.categoria && normalizarColor(props.categoria.color)))
</script>

<template>
  <span
    v-if="categoria"
    data-test="chip-categoria"
    :class="['inline-flex max-w-full items-center gap-1 rounded-full border font-semibold', grande ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-sm', tieneColor ? '' : 'border-morado-200 bg-morado-50 text-morado-800']"
    :style="estiloSolido(categoria.color)"
  ><span class="truncate">{{ categoria.nombre }}</span></span>
</template>
