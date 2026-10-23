<script setup>
import FotoMascota from '@/components/FotoMascota.vue'
import { normalizarEntrada } from '@/utils/matriz'

defineProps({
  criterios: { type: Array, required: true },
  // [{ id, participante, valores: { [criterioId]: number|null }, total, completa, esFinal }]
  filas: { type: Array, required: true },
  puestos: { type: Object, default: () => ({}) },
  estados: { type: Object, default: () => ({}) },
  enPasarelaId: { type: String, default: null },
  deshabilitada: { type: Boolean, default: false }
})
const emit = defineEmits(['cambiar', 'ver-foto'])

const TEXTO_ESTADO = { GUARDANDO: 'Guardando…', GUARDADO: 'Guardado', SIN_CONEXION: 'Sin conexión', ERROR: 'No guardado' }
const mostrar = (v) => (v === null || v === undefined ? '' : String(v))

// Botones − / +: paso de 1 dentro de 0..máximo; una casilla vacía cuenta como 0.
function ajustar(fila, criterio, delta) {
  const actual = fila.valores[criterio.id] ?? 0
  const valor = Math.min(criterio.puntaje_max, Math.max(0, actual + delta))
  emit('cambiar', { participanteId: fila.id, criterioId: criterio.id, valor })
}

function alEscribir(fila, criterio, evento) {
  const valor = normalizarEntrada(evento.target.value, criterio.puntaje_max)
  evento.target.value = mostrar(valor)
  emit('cambiar', { participanteId: fila.id, criterioId: criterio.id, valor })
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl bg-white shadow-sm" data-test="matriz">
    <table class="w-full min-w-max border-collapse text-left">
      <thead>
        <tr class="bg-morado-50 text-sm text-morado-900">
          <th scope="col" class="sticky left-0 z-10 bg-morado-50 px-2 py-2">Mascota</th>
          <th v-for="c in criterios" :key="c.id" scope="col" class="px-2 py-2 text-center" :data-test="`criterio-${c.id}`">
            {{ c.nombre }}<br /><span class="text-xs font-normal">/ {{ c.puntaje_max }}</span>
          </th>
          <th scope="col" class="px-2 py-2 text-center">Total</th>
          <th scope="col" class="px-2 py-2 text-center">Puesto</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in filas" :key="f.id" :data-test="`fila-${f.id}`"
          :class="['border-t border-morado-100', f.id === enPasarelaId ? 'bg-calabaza-50' : '']"
        >
          <th scope="row" :class="['sticky left-0 z-10 max-w-[9rem] px-2 py-1 font-semibold', f.id === enPasarelaId ? 'bg-calabaza-50' : 'bg-white']">
            <div class="flex items-center gap-2">
              <button
                type="button" class="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-calabaza-500"
                :data-test="`ver-foto-${f.id}`" :aria-label="`Ver foto de ${f.participante.mascota_nombre}`"
                @click="emit('ver-foto', f.participante)"
              >
                <FotoMascota :participante="f.participante" clase="h-12 w-12 rounded-lg" />
              </button>
              <div class="min-w-0">
                <p class="truncate">{{ f.participante.mascota_nombre }}</p>
                <p v-if="f.esFinal" class="text-xs text-green-800" :data-test="`final-${f.id}`">✓ Enviada</p>
                <p v-else-if="estados[f.id]" class="text-xs text-morado-700" :data-test="`estado-${f.id}`">{{ TEXTO_ESTADO[estados[f.id]] }}</p>
              </div>
            </div>
          </th>
          <td v-for="c in criterios" :key="c.id" class="px-1 py-1">
            <div class="flex items-center justify-center gap-1">
              <button
                type="button" class="h-11 w-11 rounded-lg bg-morado-100 text-2xl font-bold leading-none text-morado-800 active:bg-morado-200 disabled:opacity-40"
                :data-test="`menos-${f.id}-${c.id}`" :aria-label="`Restar 1 a ${c.nombre} de ${f.participante.mascota_nombre}`"
                :disabled="f.esFinal || deshabilitada" @click="ajustar(f, c, -1)"
              >−</button>
              <input
                type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off"
                class="h-11 w-14 rounded-lg border border-morado-200 text-center text-lg tabular-nums disabled:bg-gray-100"
                :data-test="`celda-${f.id}-${c.id}`"
                :aria-label="`${c.nombre} de ${f.participante.mascota_nombre} (0 a ${c.puntaje_max})`"
                :value="mostrar(f.valores[c.id])"
                :disabled="f.esFinal || deshabilitada"
                @input="alEscribir(f, c, $event)"
              />
              <button
                type="button" class="h-11 w-11 rounded-lg bg-calabaza-100 text-2xl font-bold leading-none text-calabaza-800 active:bg-calabaza-200 disabled:opacity-40"
                :data-test="`mas-${f.id}-${c.id}`" :aria-label="`Sumar 1 a ${c.nombre} de ${f.participante.mascota_nombre}`"
                :disabled="f.esFinal || deshabilitada" @click="ajustar(f, c, 1)"
              >+</button>
            </div>
          </td>
          <td class="px-2 text-center text-lg font-extrabold tabular-nums" :data-test="`total-${f.id}`">{{ f.total }}</td>
          <td class="px-2 text-center text-lg font-bold" :data-test="`puesto-${f.id}`">{{ puestos[f.id] || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
