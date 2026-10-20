<script setup>
import { computed } from 'vue'

const props = defineProps({ estado: { type: String, required: true } })
const ESTILOS = {
  INSCRITO: ['Inscrito', 'bg-gray-200 text-gray-800'],
  PRESENTE: ['Presente', 'bg-green-100 text-green-900'],
  EN_PASARELA: ['En pasarela', 'bg-calabaza-700 text-white'],
  PRESENTADO: ['Presentado', 'bg-morado-100 text-morado-900'],
  AUSENTE: ['Ausente', 'bg-red-100 text-red-900']
}
const estilo = computed(() => ESTILOS[props.estado] || [props.estado, 'bg-gray-200'])
</script>

<template>
  <span :class="['inline-block rounded-full px-3 py-1 text-sm font-semibold', estilo[1]]">{{ estilo[0] }}</span>
</template>
