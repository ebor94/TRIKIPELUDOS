<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { trk } from '@/services/api'
import { mensajeDeError } from '@/utils/errores'
import { LOGO, ALT_LOGO } from '@/utils/marca'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const modo = ref('equipo')
const usuarios = ref([])
const seleccionado = ref(null)
const pin = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const enviando = ref(false)

const ETIQUETA_ROL = { TRK_JURADO: 'Jurado', TRK_CABINA: 'Cabina', TRK_COMENTARISTA: 'Comentarista' }
const pinCompleto = computed(() => /^\d{6}$/.test(pin.value))
const sesionExpirada = computed(() => route.query.motivo === 'SESION_EXPIRADA')
const primero = (v) => String([].concat(v ?? '')[0] || '')

onMounted(async () => {
  // Con una sesión guardada (también sin conexión, con el perfil persistido) se vuelve a su pantalla (I5).
  if (auth.token && !sesionExpirada.value) {
    if (!auth.usuario) await auth.cargarPerfil().catch(() => {})
    if (auth.usuario && auth.rutaInicio !== '/login') return router.replace(auth.rutaInicio)
  }
  try {
    const { data } = await trk.get('/auth/usuarios-pin')
    usuarios.value = data
  } catch (e) {
    error.value = mensajeDeError(e)
  }
})

async function entrar(accion) {
  error.value = ''
  enviando.value = true
  try {
    await accion()
    router.push(primero(route.query.redirect) || auth.rutaInicio)
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    enviando.value = false
  }
}

const entrarConPin = () => entrar(() => auth.loginPin(seleccionado.value.id, pin.value))
const entrarComoAdmin = () => entrar(() => auth.loginAdmin(email.value, password.value))
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="sr-only">TRIKIPELUDOS · Concurso de disfraces de mascotas</h1>
      <img data-test="logo-login" :src="LOGO" :alt="ALT_LOGO" width="1396" height="664" class="h-auto w-full rounded-3xl shadow-lg" />
    </header>

    <div class="grid grid-cols-2 gap-2" role="tablist">
      <button class="btn" :class="modo === 'equipo' ? 'bg-morado-700 text-white' : 'bg-white text-morado-800'" role="tab" @click="modo = 'equipo'">Equipo del evento</button>
      <button class="btn" :class="modo === 'admin' ? 'bg-morado-700 text-white' : 'bg-white text-morado-800'" role="tab" @click="modo = 'admin'">Administrador</button>
    </div>

    <p v-if="sesionExpirada" data-test="sesion-expirada" class="rounded-xl bg-calabaza-100 p-3 text-calabaza-900" role="status">
      Tu sesión expiró, vuelve a ingresar. Si tenías calificaciones pendientes en este celular, se enviarán al entrar con tu PIN.
    </p>
    <p v-if="error" class="rounded-xl bg-red-100 p-3 text-red-800" role="alert">{{ error }}</p>

    <form v-if="modo === 'equipo'" class="flex flex-col gap-4" data-test="entrar-pin" @submit.prevent="entrarConPin">
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 font-semibold">¿Quién eres?</legend>
        <button
          v-for="u in usuarios" :key="u.id" type="button" :data-test="`usuario-${u.id}`"
          class="btn justify-between"
          :class="seleccionado && seleccionado.id === u.id ? 'bg-calabaza-700 text-white' : 'bg-white text-morado-900 border border-morado-200'"
          @click="seleccionado = u"
        >
          <span>{{ u.nombre }}</span><span class="text-sm opacity-80">{{ ETIQUETA_ROL[u.rol] }}</span>
        </button>
      </fieldset>
      <label class="flex flex-col gap-1">
        <span class="font-semibold">PIN</span>
        <input v-model="pin" data-test="pin" class="campo text-center text-2xl tracking-[0.5em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\d{6}" />
      </label>
      <button class="btn-primario" type="submit" :disabled="!seleccionado || !pinCompleto || enviando">Entrar</button>
    </form>

    <form v-else class="flex flex-col gap-4" data-test="entrar-admin" @submit.prevent="entrarComoAdmin">
      <label class="flex flex-col gap-1"><span class="font-semibold">Correo de Mantix</span>
        <input v-model="email" class="campo" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required />
      </label>
      <label class="flex flex-col gap-1"><span class="font-semibold">Contraseña</span>
        <input v-model="password" class="campo" type="password" autocomplete="current-password" required />
      </label>
      <button class="btn-primario" type="submit" :disabled="enviando">Entrar</button>
    </form>
  </main>
</template>
