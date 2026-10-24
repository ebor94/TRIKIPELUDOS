<script setup>
import { ref, computed, watch } from 'vue'
import AvatarEspecie from './AvatarEspecie.vue'
import { urlFotoRegistro } from '@/utils/fotoRegistro'

const props = defineProps({
  participante: { type: Object, required: true },
  clase: { type: String, default: 'aspect-[4/5] w-full rounded-2xl' },
  // oficial: solo la foto que sube cabina (pasarela, pantalla, jurados) · registro: solo la del formulario ·
  // perfil: la del formulario y, si no hay, la oficial (lista de cabina)
  origen: { type: String, default: 'oficial', validator: (v) => ['oficial', 'registro', 'perfil'].includes(v) }
})

const fallidas = ref(new Set())
watch(() => props.participante && props.participante.id, () => { fallidas.value = new Set() })

const fuente = computed(() => {
  const p = props.participante || {}
  const registro = urlFotoRegistro(p.foto_inscripcion_url)
  const candidatas = { oficial: [p.foto_url], registro: [registro], perfil: [registro, p.foto_url] }[props.origen]
  return candidatas.find((u) => u && !fallidas.value.has(u)) || null
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
