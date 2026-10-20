<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCalificacionStore } from '@/stores/calificacion'

defineProps({ titulo: { type: String, required: true } })
const auth = useAuthStore()
const router = useRouter()

const saliendo = ref(false)

// Antes de salir intenta enviar lo pendiente; si algo queda, el jurado decide sabiendo que solo se enviará
// cuando él mismo vuelva a entrar en este dispositivo (la cola es por jurado y exige su sesión) (I4).
async function salir() {
  if (saliendo.value) return
  const cola = useCalificacionStore()
  const id = auth.usuario && auth.usuario.id
  if (id !== null && id !== undefined && auth.tiene('calificar')) {
    saliendo.value = true
    try { await cola.sincronizar(id) } catch { /* se decide con lo que quede pendiente */ } finally { saliendo.value = false }
  }
  const n = Object.keys(cola.pendientes).length
  if (n) {
    const texto = n === 1 ? '1 calificación' : `${n} calificaciones`
    const ok = window.confirm(`Tienes ${texto} sin enviar en este celular. Si sales ahora, solo se enviarán cuando el mismo jurado vuelva a entrar con su PIN en este dispositivo. ¿Salir igual?`)
    if (!ok) return
  }
  cola.reiniciar()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-10 flex items-center justify-between gap-2 bg-morado-700 px-4 py-2 text-white">
    <h1 class="truncate text-lg font-bold">{{ titulo }}</h1>
    <div class="flex items-center gap-2">
      <span class="hidden truncate text-sm sm:inline">{{ auth.usuario && auth.usuario.nombre }}</span>
      <button class="btn min-w-tactil bg-morado-800 text-white" :disabled="saliendo" @click="salir">{{ saliendo ? 'Enviando…' : 'Salir' }}</button>
    </div>
  </header>
</template>
