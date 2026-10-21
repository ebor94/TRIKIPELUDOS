<script setup>
import { LOGO, MASCOTAS, ALT_LOGO } from '@/utils/marca'
</script>

<template>
  <div class="grid w-full max-w-6xl items-center gap-8 md:grid-cols-2">
    <img data-test="logo" :src="LOGO" :alt="ALT_LOGO" width="1396" height="664" class="h-auto w-full rounded-3xl shadow-2xl" />
    <img data-test="portada-mascotas" :src="MASCOTAS" alt="Perro disfrazado de superhéroe y gato disfrazado de bruja" width="872" height="604" class="h-auto w-full rounded-3xl shadow-2xl" />
  </div>
</template>
