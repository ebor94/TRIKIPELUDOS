<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { trk } from '@/services/api'
import { comprimirImagen } from '@/utils/imagen'
import { mensajeDeError } from '@/utils/errores'
import { useCategoriasStore } from '@/stores/categorias'
import BarraSuperior from '@/components/BarraSuperior.vue'
import FotoMascota from '@/components/FotoMascota.vue'
import EstadoChip from '@/components/EstadoChip.vue'

const categorias = useCategoriasStore()
const texto = ref('')
const resultados = ref([])
const actual = ref(null)
const datos = reactive({ disfraz_nombre: '', categoria_id: null })
const progreso = ref(null)
const aviso = ref('')
const error = ref('')
const mostrandoAlta = ref(false)
const alta = reactive({ responsable_nombre: '', responsable_telefono: '', mascota_nombre: '', especie: 'PERRO', categoria_id: null })
let espera = null

async function buscar() {
  error.value = ''
  try {
    const params = texto.value.trim() ? { q: texto.value.trim() } : {}
    resultados.value = (await trk.get('/participantes', { params })).data
  } catch (e) { error.value = mensajeDeError(e) }
}

function alEscribir() {
  clearTimeout(espera)
  espera = setTimeout(buscar, 300)
}

function abrir(p) {
  actual.value = p
  datos.disfraz_nombre = p.disfraz_nombre || ''
  datos.categoria_id = p.categoria_id
  aviso.value = ''
  progreso.value = null
}

function reemplazar(p) {
  actual.value = p
  const i = resultados.value.findIndex((r) => r.id === p.id)
  if (i >= 0) resultados.value[i] = p
  else resultados.value.unshift(p)
}

async function subirFoto(evento) {
  const archivo = evento.target.files && evento.target.files[0]
  evento.target.value = ''
  if (!archivo || !actual.value) return
  error.value = ''
  progreso.value = 0
  try {
    const blob = await comprimirImagen(archivo)
    const form = new FormData()
    form.append('foto', blob, 'foto.jpg')
    const { data } = await trk.post(`/participantes/${actual.value.id}/foto`, form, {
      onUploadProgress: (e) => { progreso.value = e.total ? Math.round((e.loaded / e.total) * 100) : null }
    })
    reemplazar(data)
    progreso.value = 100
  } catch (e) {
    error.value = mensajeDeError(e)
    progreso.value = null
  }
}

async function guardarDatos() {
  error.value = ''
  const cambios = {}
  if (datos.disfraz_nombre !== (actual.value.disfraz_nombre || '')) cambios.disfraz_nombre = datos.disfraz_nombre
  if (Number(datos.categoria_id) !== actual.value.categoria_id) cambios.categoria_id = Number(datos.categoria_id)
  if (!Object.keys(cambios).length) return
  try {
    const { data } = await trk.patch(`/participantes/${actual.value.id}`, cambios)
    reemplazar(data.participante)
    aviso.value = data.requiere_confirmacion ? 'El administrador debe confirmar el cambio de categoría porque ya hay calificaciones.' : 'Datos guardados.'
  } catch (e) { error.value = mensajeDeError(e) }
}

async function alternarAusente() {
  const estado = actual.value.estado === 'AUSENTE' ? 'INSCRITO' : 'AUSENTE'
  try { reemplazar((await trk.patch(`/participantes/${actual.value.id}/estado`, { estado })).data) } catch (e) { error.value = mensajeDeError(e) }
}

async function crearAlta() {
  error.value = ''
  try {
    const { data } = await trk.post('/participantes', { ...alta, categoria_id: Number(alta.categoria_id) })
    mostrandoAlta.value = false
    Object.assign(alta, { responsable_nombre: '', responsable_telefono: '', mascota_nombre: '', especie: 'PERRO', categoria_id: null })
    reemplazar(data)
    abrir(data)
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(async () => {
  try { await categorias.cargar() } catch (e) { error.value = mensajeDeError(e) }
})
onBeforeUnmount(() => clearTimeout(espera))
</script>

<template>
  <div class="min-h-screen pb-8">
    <BarraSuperior titulo="Cabina de recepción" />
    <main class="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

      <div class="flex gap-2">
        <input v-model="texto" data-test="buscar" class="campo flex-1" type="search" placeholder="Mascota, responsable o últimos dígitos del documento" @input="alEscribir" />
        <button class="btn-secundario" data-test="abrir-alta" @click="mostrandoAlta = !mostrandoAlta">+ Agregar</button>
      </div>

      <form v-if="mostrandoAlta" data-test="form-alta" class="tarjeta flex flex-col gap-3" @submit.prevent="crearAlta">
        <h2 class="text-lg font-bold">Inscripción de último minuto</h2>
        <input v-model="alta.responsable_nombre" data-test="alta-responsable" class="campo" placeholder="Nombre del responsable" required />
        <input v-model="alta.responsable_telefono" data-test="alta-telefono" class="campo" inputmode="tel" placeholder="Teléfono (10 dígitos)" required pattern="\d{7,10}" />
        <input v-model="alta.mascota_nombre" data-test="alta-mascota" class="campo" placeholder="Nombre de la mascota" required />
        <select v-model="alta.especie" data-test="alta-especie" class="campo"><option value="PERRO">Perro</option><option value="GATO">Gato</option></select>
        <select v-model="alta.categoria_id" data-test="alta-categoria" class="campo" required>
          <option :value="null" disabled>Categoría</option>
          <option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <button class="btn-primario" type="submit">Inscribir</button>
      </form>

      <section v-if="actual" class="tarjeta flex flex-col gap-3" aria-label="Ficha del participante">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="text-2xl font-bold">{{ actual.mascota_nombre }}</h2>
            <p class="text-morado-700">{{ actual.responsable_nombre }} · {{ actual.responsable_telefono }}</p>
          </div>
          <EstadoChip :estado="actual.estado" />
        </div>
        <FotoMascota :participante="actual" />

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label class="btn-primario min-h-[56px] text-lg">
            📷 {{ actual.foto_url ? 'Repetir foto' : 'Tomar foto' }}
            <input data-test="input-camara" class="sr-only" type="file" accept="image/*" capture="environment" @change="subirFoto" />
          </label>
          <label class="btn-claro min-h-[56px]">
            🖼️ Elegir de galería
            <input data-test="input-galeria" class="sr-only" type="file" accept="image/*" @change="subirFoto" />
          </label>
        </div>
        <div v-if="progreso !== null" class="h-3 w-full overflow-hidden rounded-full bg-morado-100" role="progressbar" :aria-valuenow="progreso">
          <div class="h-full bg-calabaza-600 transition-all" :style="{ width: `${progreso}%` }" />
        </div>
        <span v-if="progreso === 100" data-test="repetir" class="text-sm text-green-800">Foto guardada. Puedes repetirla si no quedó bien.</span>

        <form data-test="guardar-datos" class="flex flex-col gap-2" @submit.prevent="guardarDatos">
          <label class="flex flex-col gap-1"><span class="font-semibold">Nombre del disfraz</span>
            <input v-model="datos.disfraz_nombre" data-test="disfraz" class="campo" />
          </label>
          <label class="flex flex-col gap-1"><span class="font-semibold">Categoría</span>
            <select v-model="datos.categoria_id" data-test="categoria" class="campo">
              <option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </label>
          <button class="btn-secundario" type="submit">Guardar datos</button>
        </form>
        <p v-if="aviso" class="rounded-xl bg-calabaza-50 p-3 text-calabaza-900" role="status">{{ aviso }}</p>

        <button v-if="['INSCRITO', 'AUSENTE'].includes(actual.estado)" class="btn-claro" @click="alternarAusente">
          {{ actual.estado === 'AUSENTE' ? 'Quitar marca de ausente' : 'Marcar como ausente' }}
        </button>
      </section>

      <ul class="flex flex-col gap-2">
        <li v-for="p in resultados" :key="p.id">
          <button :data-test="`participante-${p.id}`" class="tarjeta flex w-full items-center gap-3 text-left" @click="abrir(p)">
            <FotoMascota :participante="p" clase="h-16 w-14 shrink-0 rounded-xl" />
            <span class="flex-1">
              <span class="block font-semibold">{{ p.mascota_nombre }}</span>
              <span class="block text-sm text-morado-600">{{ p.responsable_nombre }} · {{ p.categoria && p.categoria.nombre }}</span>
            </span>
            <EstadoChip :estado="p.estado" />
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
