<script setup>
import ChipCategoria from '@/components/ChipCategoria.vue'
import { normalizarColor } from '@/utils/colorCategoria'
import { ref, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useTiempoReal } from '@/composables/useTiempoReal'
import { mensajeDeError } from '@/utils/errores'

const auth = useAuthStore()
const datos = ref(null)
const error = ref('')
const urlPantalla = `${import.meta.env.BASE_URL}pantalla`
const ESTADOS = [['INSCRITO', 'Inscritos'], ['PRESENTE', 'Presentes'], ['EN_PASARELA', 'En pasarela'], ['PRESENTADO', 'Presentados'], ['AUSENTE', 'Ausentes']]

async function cargar() {
  try { datos.value = (await trk.get('/evento/tablero')).data } catch (e) { error.value = mensajeDeError(e) }
}
async function pantalla(cuerpo) {
  error.value = ''
  try { await trk.put('/evento/pantalla', cuerpo) } catch (e) { error.value = mensajeDeError(e) }
}

async function terminarPasarela() {
  if (!window.confirm('¿Terminar la pasarela? La mascota en pasarela quedará como presentada y la pantalla volverá a la portada.')) return
  error.value = ''
  try { await trk.post('/pasarela/terminar'); await cargar() } catch (e) { error.value = mensajeDeError(e) }
}

useTiempoReal({
  token: auth.token,
  sincronizar: cargar,
  intervaloMs: 10000,
  eventos: { 'calificacion:recibida': cargar, 'participante:actualizado': cargar, 'pasarela:cambio': cargar, 'foto:nueva': cargar }
})
onMounted(cargar)
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold">Tablero</h2>
      <div class="flex flex-wrap gap-2">
        <a class="btn-claro" data-test="abrir-pantalla" :href="urlPantalla" target="_blank" rel="noopener">Abrir pantalla</a>
        <button class="btn-secundario" data-test="pantalla-pasarela" @click="pantalla({ modo: 'PASARELA' })">Pantalla: pasarela</button>
        <button class="btn-claro" data-test="terminar-pasarela" @click="terminarPasarela">⏹ Terminar pasarela</button>
      </div>
    </div>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <template v-if="datos">
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="c in datos.categorias" :key="c.id" class="tarjeta border-t-8" :style="normalizarColor(c.color) ? { borderTopColor: normalizarColor(c.color) } : {}" :data-test="`tarjeta-categoria-${c.id}`">
          <h3 class="flex flex-wrap items-center gap-2 font-bold"><ChipCategoria :categoria="c" /> <span class="text-sm font-normal">({{ c.total }})</span></h3>
          <p class="text-sm text-morado-600">{{ c.abierta ? 'Abierta' : 'Cerrada' }} · {{ c.ranking_publicado ? 'Publicada' : 'Sin publicar' }}</p>
          <dl class="mt-2 grid grid-cols-3 gap-1 text-sm">
            <template v-for="[clave, texto] in ESTADOS" :key="clave"><dt>{{ texto }}</dt><dd class="col-span-2 font-semibold">{{ c.por_estado[clave] }}</dd></template>
          </dl>
        </article>
      </div>
      <article class="tarjeta">
        <h3 class="mb-2 font-bold">Progreso de jurados ({{ datos.calificables }} mascotas calificables)</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="j in datos.jurados" :key="j.id">
            <div class="flex justify-between"><span>{{ j.nombre }}<span v-if="!j.activo"> (inactivo)</span></span><span>{{ j.calificadas }} / {{ datos.calificables }}</span></div>
            <div class="h-2 overflow-hidden rounded-full bg-morado-100"><div class="h-full bg-calabaza-600" :style="{ width: datos.calificables ? `${(j.calificadas / datos.calificables) * 100}%` : '0%' }" /></div>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
