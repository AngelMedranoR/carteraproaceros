<script setup lang="ts">
import type { Cuenta } from '~/types'

const props = defineProps<{ cuentas: Cuenta[]; tipo: 'cliente' | 'proveedor' }>()
const emit = defineEmits<{ eliminar: [id: string] }>()

const { formatDivisas } = useCurrency()
const { getEstado } = useAccountStatus()

const search = ref('')
const sortBy = ref<'saldo' | 'nombre'>('saldo')
const page = ref(1)
const pageSize = 20

// 1. Precomputar saldos y estados solo cuando cambia la lista de cuentas
const filasBase = computed(() => {
  return props.cuentas.map((cuenta) => ({
    cuenta,
    saldo: saldoPendiente(cuenta),
    estado: getEstado(cuenta),
    nombreLower: cuenta.nombre.toLowerCase(),
  }))
})

// 2. Filtrado y ordenación instantáneos en memoria
const filasFiltradas = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = filasBase.value
  if (q) list = list.filter((f) => f.nombreLower.includes(q))
  if (sortBy.value === 'saldo') {
    return [...list].sort((a, b) => b.saldo - a.saldo)
  } else {
    return [...list].sort((a, b) => a.cuenta.nombre.localeCompare(b.cuenta.nombre))
  }
})

// Reiniciar a página 1 al cambiar búsqueda o criterio de orden
watch([search, sortBy], () => {
  page.value = 1
})

const totalPaginas = computed(() => Math.max(1, Math.ceil(filasFiltradas.value.length / pageSize)))

watch(totalPaginas, (max) => {
  if (page.value > max) page.value = max
})

const filasPaginadas = computed(() => {
  const start = (page.value - 1) * pageSize
  return filasFiltradas.value.slice(start, start + pageSize)
})

const rutaBase = props.tipo === 'cliente' ? '/cobrar' : '/pagar'
const etiquetaPersona = props.tipo === 'cliente' ? 'cliente' : 'proveedor'

function confirmarEliminar(id: string, nombre: string) {
  if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar a "${nombre}" y todo su historial?`)) return
  emit('eliminar', id)
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <UInput
        v-model="search"
        :placeholder="`Buscar ${etiquetaPersona}...`"
        icon="i-heroicons-magnifying-glass"
        class="sm:max-w-xs"
      />
      <USelectMenu
        v-model="sortBy"
        :options="[{ label: 'Mayor saldo', value: 'saldo' }, { label: 'Nombre A-Z', value: 'nombre' }]"
        value-attribute="value"
        option-attribute="label"
        class="sm:w-44"
      />
      <p class="sm:ml-auto text-xs" style="color: var(--ink-text-muted)">
        {{ filasFiltradas.length }} {{ filasFiltradas.length === 1 ? etiquetaPersona : (tipo === 'cliente' ? 'clientes' : 'proveedores') }}
      </p>
    </div>

    <div v-if="filasFiltradas.length === 0" class="py-16 text-center">
      <UIcon name="i-heroicons-inbox" class="h-8 w-8 mx-auto mb-3" style="color: var(--ink-text-muted)" />
      <p style="color: var(--ink-text-secondary)">Sin resultados.</p>
    </div>

    <div v-else>
      <ul class="ledger-rule -mt-1 w-full min-w-0">
        <li v-for="fila in filasPaginadas" :key="fila.cuenta.id" class="py-3.5 first:pt-0">
          <NuxtLink
            :to="`${rutaBase}/${fila.cuenta.id}`"
            class="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_1.5rem] items-center gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 group w-full min-w-0"
          >
            <div class="min-w-0 col-span-2 sm:col-span-1">
              <p class="font-medium truncate group-hover:underline" style="color: var(--ink-text)">
                {{ fila.cuenta.nombre }}
              </p>
              <p class="text-xs mt-0.5 truncate" style="color: var(--ink-text-muted)">
                {{ fila.cuenta.creditos.length }} créditos · {{ fila.cuenta.abonos.length }} abonos
              </p>
            </div>
            <StatusBadge :estado="fila.estado" class="justify-self-start sm:justify-self-end shrink-0" />
            <p
              class="font-figures font-semibold text-right sm:text-left justify-self-end sm:justify-self-auto truncate"
              :style="{ color: tipo === 'cliente' ? 'var(--cobrar)' : 'var(--pagar)' }"
            >
              {{ formatDivisas(fila.saldo) }}
            </p>
            <UButton
              icon="i-heroicons-trash"
              color="gray"
              variant="ghost"
              size="2xs"
              class="hidden sm:inline-flex shrink-0"
              @click.prevent.stop="confirmarEliminar(fila.cuenta.id, fila.cuenta.nombre)"
            />
          </NuxtLink>
        </li>
      </ul>

      <!-- Barra de paginación ligera -->
      <div
        v-if="totalPaginas > 1"
        class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-[var(--ink-border)]/60 text-xs"
        style="color: var(--ink-text-secondary)"
      >
        <p>
          Mostrando {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, filasFiltradas.length) }} de {{ filasFiltradas.length }} {{ tipo === 'cliente' ? 'clientes' : 'proveedores' }}
        </p>
        <div class="flex items-center gap-1.5">
          <UButton
            icon="i-heroicons-chevron-left"
            size="xs"
            color="gray"
            variant="outline"
            :disabled="page <= 1"
            @click="page--"
          >
            Anterior
          </UButton>
          <span class="px-2 font-medium" style="color: var(--ink-text)">
            Página {{ page }} de {{ totalPaginas }}
          </span>
          <UButton
            trailing-icon="i-heroicons-chevron-right"
            size="xs"
            color="gray"
            variant="outline"
            :disabled="page >= totalPaginas"
            @click="page++"
          >
            Siguiente
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
