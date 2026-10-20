<script setup>
import { ref, computed, watch } from 'vue'
import AvatarEspecie from './AvatarEspecie.vue'

const props = defineProps({
  participante: { type: Object, required: true },
  clase: { type: String, default: 'aspect-[4/5] w-full rounded-2xl' }
})

const fallidas = ref(new Set())
watch(() => props.participante && props.participante.id, () => { fallidas.value = new Set() })

const fuente = computed(() => {
  const p = props.participante || {}
  return [p.foto_url, p.foto_inscripcion_url].find((u) => u && !fallidas.value.has(u)) || null
})

const tipoAvatar = computed(() => {
  const p = props.participante || {}
  if (p.categoria && p.categoria.codigo === 'FAMILIAR') return 'familia'
  return p.especie === 'GATO' ? 'gato' : 'perro'
})

function alFallar() {
  fallidas.value = new Set([...fallidas.value, fuente.value])
}
</script>

<template>
  <div :class="['overflow-hidden bg-morado-50', clase]">
    <img v-if="fuente" :src="fuente" :alt="participante.mascota_nombre" class="h-full w-full object-cover" loading="lazy" @error="alFallar" />
    <AvatarEspecie v-else :tipo="tipoAvatar" />
  </div>
</template>
