<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { trk } from '@/services/api'
import { useCategoriasStore } from '@/stores/categorias'
import { mensajeDeError } from '@/utils/errores'

const categorias = useCategoriasStore()
const vista = ref(null)
const resultado = ref(null)
const error = ref('')
const cargando = ref(false)
const decisiones = reactive({ omitir: new Set(), conservar: {}, categoria: {} })

const nombreCategoria = (codigo) => (categorias.porCodigo(codigo) || {}).nombre || codigo || '—'
const categoriaFinal = (f) => decisiones.categoria[f.indice] || f.datos.categoria_codigo
const conservada = (f) => !f.grupo_duplicado || Number(decisiones.conservar[f.grupo_duplicado]) === f.indice
const seImporta = (f) => !decisiones.omitir.has(f.indice) && conservada(f) && Boolean(categoriaFinal(f))
  && Boolean(f.datos.mascota_nombre) && Boolean(f.datos.responsable_nombre)
const totalAImportar = computed(() => (vista.value ? vista.value.filas.filter(seImporta).length : 0))

onMounted(() => categorias.cargar().catch((e) => { error.value = mensajeDeError(e) }))

async function subir(evento) {
  const archivo = evento.target.files && evento.target.files[0]
  if (!archivo) return
  const input = evento.target
  error.value = ''
  resultado.value = null
  cargando.value = true
  try {
    const form = new FormData()
    form.append('archivo', archivo)
    vista.value = (await trk.post('/import/preview', form)).data
    decisiones.omitir = new Set()
    decisiones.categoria = {}
    decisiones.conservar = {}
    for (const f of vista.value.filas) if (f.grupo_duplicado && f.conservar_por_defecto) decisiones.conservar[f.grupo_duplicado] = f.indice
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
    input.value = ''
  }
}

function alternarOmitir(f) {
  if (decisiones.omitir.has(f.indice)) decisiones.omitir.delete(f.indice)
  else decisiones.omitir.add(f.indice)
  decisiones.omitir = new Set(decisiones.omitir)
}

async function confirmar() {
  error.value = ''
  cargando.value = true
  try {
    resultado.value = (await trk.post('/import/confirm', {
      preview_token: vista.value.preview_token,
      decisiones: { omitir: [...decisiones.omitir], conservar: { ...decisiones.conservar }, categoria: { ...decisiones.categoria } }
    })).data
    vista.value = null
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Importar inscripciones</h2>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>
    <p v-if="resultado" class="rounded-xl bg-green-100 p-3 text-green-900" role="status">
      Importación lista: {{ resultado.creados }} creados, {{ resultado.actualizados }} actualizados, {{ resultado.omitidos }} omitidos.
    </p>

    <label class="tarjeta flex flex-col gap-2">
      <span class="font-semibold">Archivo CSV exportado de la hoja TRIKIPELUDOS</span>
      <input data-test="archivo" type="file" accept=".csv,text/csv" class="campo py-2" :disabled="cargando" @change="subir" />
    </label>

    <template v-if="vista">
      <div class="tarjeta">
        <p><strong>{{ vista.archivo_nombre }}</strong> · {{ vista.resumen.total }} filas · {{ vista.resumen.con_advertencias }} con advertencias · {{ vista.resumen.con_errores }} con errores</p>
        <p class="text-sm text-morado-600">Nada se guarda hasta confirmar. Se importarán {{ totalAImportar }} filas.</p>
      </div>

      <ul class="flex flex-col gap-2">
        <li v-for="f in vista.filas" :key="f.indice" class="tarjeta flex flex-col gap-2" :class="seImporta(f) ? '' : 'opacity-60'">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold">Línea {{ f.linea }} · {{ f.datos.mascota_nombre || '(sin nombre)' }} <span class="font-normal text-morado-600">· {{ f.datos.responsable_nombre }}</span></p>
            <span class="rounded-full bg-morado-100 px-3 py-1 text-sm">{{ nombreCategoria(categoriaFinal(f)) }}</span>
          </div>
          <ul class="flex flex-col gap-1 text-sm">
            <li v-for="(a, i) in f.advertencias" :key="`a${i}`" class="flex flex-wrap items-center gap-2 rounded-lg bg-calabaza-50 p-2 text-calabaza-900">
              ⚠️ {{ a.mensaje }}
              <button v-if="a.sugerencia && categoriaFinal(f) !== a.sugerencia" class="btn-claro" :data-test="`sugerencia-${f.indice}`" @click="decisiones.categoria[f.indice] = a.sugerencia">
                Usar {{ nombreCategoria(a.sugerencia) }}
              </button>
            </li>
            <li v-for="(e, i) in f.errores" :key="`e${i}`" class="rounded-lg bg-red-50 p-2 text-red-800">⛔ {{ e.mensaje }}</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <label v-if="f.grupo_duplicado" class="flex min-h-tactil items-center gap-2">
              <input type="radio" :name="f.grupo_duplicado" :value="f.indice" :data-test="`conservar-${f.indice}`" :checked="conservada(f)" @change="decisiones.conservar[f.grupo_duplicado] = f.indice" />
              Conservar esta
            </label>
            <label v-if="f.errores.length" class="flex min-h-tactil items-center gap-2">
              Categoría:
              <select class="campo min-h-tactil w-auto" :data-test="`categoria-${f.indice}`" :value="decisiones.categoria[f.indice] || ''" @change="decisiones.categoria[f.indice] = $event.target.value">
                <option value="">—</option>
                <option v-for="c in categorias.lista" :key="c.codigo" :value="c.codigo">{{ c.nombre }}</option>
              </select>
            </label>
            <label class="flex min-h-tactil items-center gap-2">
              <input type="checkbox" :checked="decisiones.omitir.has(f.indice)" :data-test="`omitir-${f.indice}`" @change="alternarOmitir(f)" />
              Omitir
            </label>
          </div>
        </li>
      </ul>

      <button class="btn-primario sticky bottom-4" data-test="confirmar" :disabled="cargando || !totalAImportar" @click="confirmar">
        Confirmar importación ({{ totalAImportar }})
      </button>
    </template>
  </section>
</template>
