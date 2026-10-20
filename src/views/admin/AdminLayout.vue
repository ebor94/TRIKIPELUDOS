<script setup>
import BarraSuperior from '@/components/BarraSuperior.vue'

const enlaces = [
  { to: '/admin', texto: 'Tablero', exacto: true },
  { to: '/admin/importar', texto: 'Importar' },
  { to: '/admin/participantes', texto: 'Participantes' },
  { to: '/admin/ranking', texto: 'Ranking' },
  { to: '/admin/usuarios', texto: 'Usuarios' },
  { to: '/cabina', texto: 'Cabina' }
]
</script>

<template>
  <div class="min-h-screen">
    <BarraSuperior titulo="TRIKIPELUDOS · Admin" :enlace-admin="false" />
    <nav class="flex gap-1 overflow-x-auto bg-white px-2 py-1 shadow-sm">
      <RouterLink
        v-for="e in enlaces" :key="e.to" :to="e.to"
        class="btn whitespace-nowrap text-morado-800"
        :exact-active-class="e.exacto ? 'bg-calabaza-100 text-calabaza-800' : ''"
        :active-class="e.exacto ? '' : 'bg-calabaza-100 text-calabaza-800'"
      >{{ e.texto }}</RouterLink>
    </nav>
    <main class="mx-auto max-w-5xl p-4"><RouterView /></main>
  </div>
</template>
