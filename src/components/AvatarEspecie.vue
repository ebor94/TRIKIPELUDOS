<script setup>
defineProps({ tipo: { type: String, default: 'perro' } })
</script>

<template>
  <div data-test="avatar" :data-tipo="tipo" class="flex h-full w-full items-center justify-center bg-morado-100 text-morado-700" role="img" :aria-label="`Avatar de ${tipo}`">
    <svg v-if="tipo === 'gato'" viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><path d="M12 8l10 12h20L52 8v30c0 11-9 18-20 18S12 49 12 38z"/><circle cx="24" cy="34" r="3" fill="#fff"/><circle cx="40" cy="34" r="3" fill="#fff"/></svg>
    <svg v-else-if="tipo === 'familia'" viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><circle cx="20" cy="16" r="7"/><circle cx="44" cy="16" r="7"/><path d="M8 44c0-9 5-16 12-16s12 7 12 16zM32 44c0-9 5-16 12-16s12 7 12 16z"/><circle cx="32" cy="50" r="7"/></svg>
    <svg v-else viewBox="0 0 64 64" class="h-1/2 w-1/2" fill="currentColor"><path d="M14 14l8 6h20l8-6 4 18c0 14-10 24-22 24S10 46 10 32z"/><circle cx="24" cy="32" r="3" fill="#fff"/><circle cx="40" cy="32" r="3" fill="#fff"/><ellipse cx="32" cy="42" rx="5" ry="3" fill="#fff"/></svg>
  </div>
</template>
