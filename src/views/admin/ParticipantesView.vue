<script setup>
import { ref, reactive, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useCategoriasStore } from '@/stores/categorias'
import { mensajeDeError } from '@/utils/errores'
import EstadoChip from '@/components/EstadoChip.vue'

const categorias = useCategoriasStore()
const filtros = reactive({ categoria: '', estado: '', q: '' })
const lista = ref([])
const error = ref('')
const aviso = ref('')
const editando = ref(null)
const formulario = reactive({})
const fusionando = ref(null)
const destinoFusion = ref('')

const CAMPOS = [
  ['mascota_nombre', 'Mascota'], ['disfraz_nombre', 'Disfraz'], ['raza', 'Raza'], ['edad_texto', 'Edad'],
  ['responsable_nombre', 'Responsable'], ['responsable_documento', 'Documento'], ['responsable_telefono', 'Teléfono'], ['responsable_correo', 'Correo']
]
// El backend rechaza cadenas vacías en estos campos: vaciar = null
const ANULABLES = ['responsable_documento', 'responsable_telefono', 'responsable_correo']
const ESTADOS = ['INSCRITO', 'PRESENTE', 'EN_PASARELA', 'PRESENTADO', 'AUSENTE']
const nombreCategoria = (id) => (categorias.porId(id) || {}).nombre || '—'

async function cargar() {
  error.value = ''
  try {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''))
    lista.value = (await trk.get('/participantes', { params })).data
  } catch (e) { error.value = mensajeDeError(e) }
}

function reemplazar(p) {
  const i = lista.value.findIndex((x) => x.id === p.id)
  if (i >= 0) lista.value[i] = { ...lista.value[i], ...p }
}

function editar(p) {
  editando.value = p
  for (const [campo] of CAMPOS) formulario[campo] = p[campo] ?? ''
}

async function guardarEdicion() {
  const cambios = Object.fromEntries(
    CAMPOS.map(([c]) => [c, formulario[c]])
      .filter(([c, v]) => v !== (editando.value[c] ?? ''))
      .map(([c, v]) => [c, v === '' && ANULABLES.includes(c) ? null : v])
  )
  if (!Object.keys(cambios).length) { editando.value = null; return }
  try {
    const { data } = await trk.patch(`/participantes/${editando.value.id}`, cambios)
    reemplazar(data.participante)
    editando.value = null
    aviso.value = 'Cambios guardados'
  } catch (e) { error.value = mensajeDeError(e) }
}

async function confirmarCategoria(p, confirmar = false) {
  error.value = ''
  try {
    const { data } = await trk.post(`/participantes/${p.id}/categoria/confirmar`, { confirmar })
    reemplazar(data)
    aviso.value = `Categoría de ${p.mascota_nombre} actualizada`
  } catch (e) {
    if (e.motivo === 'CONFIRMACION_REQUERIDA' && !confirmar && window.confirm(`${e.message}. ¿Continuar?`)) return confirmarCategoria(p, true)
    error.value = mensajeDeError(e)
  }
}

async function fusionar() {
  error.value = ''
  try {
    await trk.post(`/participantes/${fusionando.value.id}/fusionar`, { destino_id: destinoFusion.value })
    aviso.value = `${fusionando.value.mascota_nombre} fusionado`
    fusionando.value = null
    destinoFusion.value = ''
    await cargar()
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(async () => {
  try { await categorias.cargar() } catch (e) { error.value = mensajeDeError(e) }
  await cargar()
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Participantes</h2>
    <form class="tarjeta grid gap-2 sm:grid-cols-4" @submit.prevent="cargar">
      <input v-model="filtros.q" class="campo sm:col-span-2" type="search" placeholder="Buscar mascota, responsable o documento" />
      <select v-model="filtros.categoria" class="campo"><option value="">Todas las categorías</option><option v-for="c in categorias.lista" :key="c.id" :value="c.id">{{ c.nombre }}</option></select>
      <select v-model="filtros.estado" class="campo"><option value="">Todos los estados</option><option v-for="e in ESTADOS" :key="e" :value="e">{{ e }}</option></select>
      <button class="btn-secundario sm:col-span-4" type="submit">Filtrar</button>
    </form>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="aviso" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">{{ aviso }}</p>

    <ul class="flex flex-col gap-2">
      <li v-for="p in lista" :key="p.id" class="tarjeta flex flex-col gap-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-lg font-bold">{{ p.mascota_nombre }} <span class="text-sm font-normal text-morado-600">· {{ p.responsable_nombre }} · {{ p.responsable_documento }}</span></p>
            <p class="text-sm">{{ nombreCategoria(p.categoria_id) }}<span v-if="p.categoria_propuesta_id" class="text-calabaza-800"> → propuesta: {{ nombreCategoria(p.categoria_propuesta_id) }}</span></p>
          </div>
          <EstadoChip :estado="p.estado" />
        </div>
        <ul v-if="p.advertencias_importacion && p.advertencias_importacion.length" class="text-sm">
          <li v-for="(a, i) in p.advertencias_importacion" :key="i" class="text-calabaza-900">⚠️ {{ a.mensaje }}</li>
        </ul>
        <p v-if="p.notas_importacion" class="text-sm text-morado-700">📝 {{ p.notas_importacion }}</p>
        <div class="flex flex-wrap gap-2">
          <button class="btn-claro" :data-test="`editar-${p.id}`" @click="editar(p)">Editar</button>
          <button v-if="p.categoria_propuesta_id" class="btn-primario" :data-test="`confirmar-categoria-${p.id}`" @click="confirmarCategoria(p)">Confirmar categoría</button>
          <button class="btn-claro" :data-test="`fusionar-${p.id}`" @click="fusionando = p">Fusionar…</button>
        </div>

        <form v-if="editando && editando.id === p.id" data-test="guardar-edicion" class="grid gap-2 sm:grid-cols-2" @submit.prevent="guardarEdicion">
          <label v-for="[campo, texto] in CAMPOS" :key="campo" class="flex flex-col gap-1 text-sm">{{ texto }}
            <input v-model="formulario[campo]" class="campo" :data-test="`campo-${campo}`" />
          </label>
          <button class="btn-primario sm:col-span-2" type="submit">Guardar</button>
        </form>

        <div v-if="fusionando && fusionando.id === p.id" class="flex flex-col gap-2 rounded-xl bg-morado-50 p-3">
          <p class="text-sm">Fusionar <strong>{{ p.mascota_nombre }}</strong> en (se conserva el destino):</p>
          <select v-model="destinoFusion" class="campo" data-test="destino-fusion">
            <option value="">Elige el registro destino</option>
            <option v-for="o in lista.filter((x) => x.id !== p.id)" :key="o.id" :value="o.id">{{ o.mascota_nombre }} · {{ o.responsable_nombre }}</option>
          </select>
          <button class="btn-primario" data-test="confirmar-fusion" :disabled="!destinoFusion" @click="fusionar">Fusionar</button>
        </div>
      </li>
    </ul>
  </section>
</template>
