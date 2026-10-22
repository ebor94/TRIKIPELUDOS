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
const emit = defineEmits(['cambiar'])

const TEXTO_ESTADO = { GUARDANDO: 'Guardando…', GUARDADO: 'Guardado', SIN_CONEXION: 'Sin conexión', ERROR: 'No guardado' }
const mostrar = (v) => (v === null || v === undefined ? '' : String(v))

function alEscribir(fila, criterio, evento) {
  const valor = normalizarEntrada(evento.target.value, criterio.puntaje_max)
  evento.target.value = mostrar(valor)
  emit('cambiar', { participanteId: fila.id, criterioId: criterio.id, valor })
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl bg-white shadow-sm" data-test="matriz">
    <table class="min-w-max border-collapse text-left">
      <thead>
        <tr class="bg-morado-50 text-sm text-morado-900">
          <th scope="col" class="sticky left-0 z-10 bg-morado-50 px-2 py-2">Mascota</th>
          <th v-for="c in criterios" :key="c.id" scope="col" class="px-1 py-2 text-center" :data-test="`criterio-${c.id}`">
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
              <FotoMascota :participante="f.participante" clase="h-10 w-10 shrink-0 rounded-lg" />
              <div class="min-w-0">
                <p class="truncate">{{ f.participante.mascota_nombre }}</p>
                <p v-if="f.esFinal" class="text-xs text-green-800" :data-test="`final-${f.id}`">✓ Enviada</p>
                <p v-else-if="estados[f.id]" class="text-xs text-morado-700" :data-test="`estado-${f.id}`">{{ TEXTO_ESTADO[estados[f.id]] }}</p>
              </div>
            </div>
          </th>
          <td v-for="c in criterios" :key="c.id" class="px-1 py-1 text-center">
            <input
              type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off"
              class="h-11 w-14 rounded-lg border border-morado-200 text-center text-lg tabular-nums disabled:bg-gray-100"
              :data-test="`celda-${f.id}-${c.id}`"
              :aria-label="`${c.nombre} de ${f.participante.mascota_nombre} (0 a ${c.puntaje_max})`"
              :value="mostrar(f.valores[c.id])"
              :disabled="f.esFinal || deshabilitada"
              @input="alEscribir(f, c, $event)"
            />
          </td>
          <td class="px-2 text-center text-lg font-extrabold tabular-nums" :data-test="`total-${f.id}`">{{ f.total }}</td>
          <td class="px-2 text-center text-lg font-bold" :data-test="`puesto-${f.id}`">{{ puestos[f.id] || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
