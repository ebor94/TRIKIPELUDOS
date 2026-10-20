<script setup>
import { ref, onMounted } from 'vue'
import { trk } from '@/services/api'
import { mensajeDeError } from '@/utils/errores'

const ROLES = [
  { valor: 'TRK_JURADO', texto: 'Jurado' },
  { valor: 'TRK_CABINA', texto: 'Cabina' },
  { valor: 'TRK_COMENTARISTA', texto: 'Comentarista' }
]
const textoRol = (v) => (ROLES.find((r) => r.valor === v) || {}).texto || v

const usuarios = ref([])
const nombre = ref('')
const rol = ref('TRK_JURADO')
const pinMostrado = ref(null)
const error = ref('')
const creando = ref(false)

async function cargar() {
  try { usuarios.value = (await trk.get('/usuarios')).data } catch (e) { error.value = mensajeDeError(e) }
}

// Un doble toque crearía un jurado activo duplicado y dejaría todas las mascotas Incompletas en el ranking.
async function crear() {
  if (creando.value) return
  creando.value = true
  error.value = ''
  try {
    const { data } = await trk.post('/usuarios', { nombre: nombre.value, rol: rol.value })
    usuarios.value.push(data.usuario)
    pinMostrado.value = { nombre: data.usuario.nombre, pin: data.pin }
    nombre.value = ''
  } catch (e) { error.value = mensajeDeError(e) } finally { creando.value = false }
}

async function regenerar(u) {
  if (!window.confirm(`¿Regenerar el PIN de ${u.nombre}? Sus sesiones abiertas se cerrarán.`)) return
  try {
    const { data } = await trk.post(`/usuarios/${u.id}/pin`)
    pinMostrado.value = { nombre: u.nombre, pin: data.pin }
  } catch (e) { error.value = mensajeDeError(e) }
}

async function alternarActivo(u) {
  try {
    const { data } = await trk.patch(`/usuarios/${u.id}`, { activo: !u.activo })
    Object.assign(u, data)
  } catch (e) { error.value = mensajeDeError(e) }
}

onMounted(cargar)
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-bold">Jurados y accesos</h2>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

    <div v-if="pinMostrado" data-test="pin-nuevo" class="tarjeta border-2 border-calabaza-500">
      <p>PIN de <strong>{{ pinMostrado.nombre }}</strong> (se muestra una sola vez):</p>
      <p class="my-2 text-center font-mono text-4xl tracking-[0.3em]">{{ pinMostrado.pin }}</p>
      <button class="btn-claro w-full" data-test="cerrar-pin" @click="pinMostrado = null">Ya lo anoté</button>
    </div>

    <form class="tarjeta flex flex-col gap-3 sm:flex-row sm:items-end" data-test="crear" @submit.prevent="crear">
      <label class="flex flex-1 flex-col gap-1"><span class="font-semibold">Nombre</span>
        <input v-model="nombre" data-test="nombre" class="campo" required minlength="2" maxlength="60" />
      </label>
      <label class="flex flex-col gap-1"><span class="font-semibold">Rol</span>
        <select v-model="rol" data-test="rol" class="campo">
          <option v-for="r in ROLES" :key="r.valor" :value="r.valor">{{ r.texto }}</option>
        </select>
      </label>
      <button class="btn-primario" type="submit" :disabled="creando">{{ creando ? 'Creando…' : 'Crear' }}</button>
    </form>

    <ul class="flex flex-col gap-2">
      <li v-for="u in usuarios" :key="u.id" class="tarjeta flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-semibold">{{ u.nombre }}</p>
          <p class="text-sm text-morado-600">{{ textoRol(u.rol) }} · <span>{{ u.activo ? 'Activo' : 'Inactivo' }}</span></p>
        </div>
        <div class="flex gap-2">
          <button class="btn-claro" :data-test="`regenerar-${u.id}`" @click="regenerar(u)">Nuevo PIN</button>
          <button class="btn-claro" :data-test="`activo-${u.id}`" @click="alternarActivo(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
        </div>
      </li>
    </ul>
  </section>
</template>
