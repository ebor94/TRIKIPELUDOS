<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'

defineProps({ titulo: { type: String, required: true } })
const auth = useAuthStore()
const router = useRouter()

function salir() {
  useCalificacionStore().reiniciar()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-10 flex items-center justify-between gap-2 bg-morado-700 px-4 py-2 text-white">
    <h1 class="truncate text-lg font-bold">{{ titulo }}</h1>
    <div class="flex items-center gap-2">
      <span class="hidden truncate text-sm sm:inline">{{ auth.usuario && auth.usuario.nombre }}</span>
      <button class="btn min-w-tactil bg-morado-800 text-white" @click="salir">Salir</button>
    </div>
  </header>
</template>
