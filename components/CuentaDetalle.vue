<script setup lang="ts">
const props = defineProps<{ tipo: 'cliente' | 'proveedor' }>()

const route = useRoute()
const router = useRouter()
const store = useAccountsStore()
const toast = useToast()
const { formatDivisas, formatBolivares, formatDate } = useCurrency()
const { getEstado } = useAccountStatus()

onMounted(() => store.hydrate())

const rutaBase = props.tipo === 'cliente' ? '/cobrar' : '/pagar'
const acento = props.tipo === 'cliente' ? 'var(--cobrar)' : 'var(--pagar)'
const colorBtn = props.tipo === 'cliente' ? 'amber' : 'blue'

const cuenta = computed(() => store.cuentas.find((c) => c.id === route.params.id))

const saldo = computed(() => (cuenta.value ? saldoPendiente(cuenta.value) : 0))
const estado = computed(() => (cuenta.value ? getEstado(cuenta.value) : 'pendiente'))

const creditosOrdenados = computed(() =>
  cuenta.value ? [...cuenta.value.creditos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')) : []
)
const abonosOrdenados = computed(() =>
  cuenta.value ? [...cuenta.value.abonos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')) : []
)

const modalCredito = ref(false)
const modalAbono = ref(false)

function eliminarCredito(id: string) {
  if (!cuenta.value) return
  store.eliminarCredito(cuenta.value.id, id)
  toast.add({ title: 'Crédito eliminado', color: 'gray', icon: 'i-heroicons-trash' })
}
function eliminarAbono(id: string) {
  if (!cuenta.value) return
  store.eliminarAbono(cuenta.value.id, id)
  toast.add({ title: 'Abono eliminado', color: 'gray', icon: 'i-heroicons-trash' })
}

const modalEliminarCuenta = ref(false)
function eliminarCuenta() {
  if (!cuenta.value) return
  store.eliminarCuenta(cuenta.value.id)
  router.push(rutaBase)
}
</script>

<template>
  <div v-if="!cuenta" class="py-20 text-center">
    <UIcon name="i-heroicons-face-frown" class="h-8 w-8 mx-auto mb-3" style="color: var(--ink-text-muted)" />
    <p style="color: var(--ink-text-secondary)">No se encontró esta cuenta.</p>
    <UButton :to="rutaBase" class="mt-4" color="gray" variant="soft">Volver</UButton>
  </div>

  <div v-else>
    <UButton :to="rutaBase" icon="i-heroicons-arrow-left" color="gray" variant="ghost" size="sm" class="mb-4">
      {{ tipo === 'cliente' ? 'Clientes' : 'Proveedores' }}
    </UButton>

    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="font-display text-3xl" style="color: var(--ink-text)">{{ cuenta.nombre }}</h1>
          <StatusBadge :estado="estado" />
        </div>
        <p class="font-figures text-2xl mt-2 font-semibold" :style="{ color: acento }">{{ formatDivisas(saldo) }}</p>
        <p class="text-sm" style="color: var(--ink-text-muted)">Saldo pendiente</p>
      </div>
      <div class="flex gap-2">
        <UButton :color="colorBtn" icon="i-heroicons-document-plus" @click="modalCredito = true">Crédito</UButton>
        <UButton :color="colorBtn" variant="outline" icon="i-heroicons-banknotes" @click="modalAbono = true">Abono</UButton>
        <UButton color="gray" variant="ghost" icon="i-heroicons-trash" @click="modalEliminarCuenta = true" />
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Créditos</h2>
            <span class="text-xs" style="color: var(--ink-text-muted)">{{ creditosOrdenados.length }} facturas</span>
          </div>
        </template>
        <div v-if="creditosOrdenados.length === 0" class="py-10 text-center text-sm" style="color: var(--ink-text-muted)">
          Sin créditos registrados.
        </div>
        <ul v-else class="ledger-rule -mt-1 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
          <li v-for="c in creditosOrdenados" :key="c.id" class="py-3 first:pt-0 flex items-start justify-between gap-3 group">
            <div class="min-w-0">
              <p class="text-sm font-medium" style="color: var(--ink-text)">{{ formatDate(c.fecha) }}</p>
              <p class="text-xs mt-0.5" style="color: var(--ink-text-muted)">
                Factura {{ c.numeroFactura || '—' }} <span v-if="c.montoBolivares"> · {{ formatBolivares(c.montoBolivares) }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-figures font-semibold text-sm" :style="{ color: acento }">{{ formatDivisas(c.montoDivisas) }}</span>
              <UButton icon="i-heroicons-x-mark" color="gray" variant="ghost" size="2xs" class="opacity-0 group-hover:opacity-100" @click="eliminarCredito(c.id)" />
            </div>
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Abonos</h2>
            <span class="text-xs" style="color: var(--ink-text-muted)">{{ abonosOrdenados.length }} pagos</span>
          </div>
        </template>
        <div v-if="abonosOrdenados.length === 0" class="py-10 text-center text-sm" style="color: var(--ink-text-muted)">
          Sin abonos registrados.
        </div>
        <ul v-else class="ledger-rule -mt-1 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
          <li v-for="a in abonosOrdenados" :key="a.id" class="py-3 first:pt-0 flex items-start justify-between gap-3 group">
            <div class="min-w-0">
              <p class="text-sm font-medium" style="color: var(--ink-text)">{{ formatDate(a.fecha) }}</p>
              <p class="text-xs mt-0.5 truncate" style="color: var(--ink-text-muted)">{{ a.comentario || '—' }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-figures font-semibold text-sm" style="color: var(--status-good)">{{ formatDivisas(a.montoDivisas) }}</span>
              <UButton icon="i-heroicons-x-mark" color="gray" variant="ghost" size="2xs" class="opacity-0 group-hover:opacity-100" @click="eliminarAbono(a.id)" />
            </div>
          </li>
        </ul>
      </UCard>
    </div>

    <CreditoFormModal v-model="modalCredito" :cuenta-id="cuenta.id" :tipo="tipo" />
    <AbonoFormModal v-model="modalAbono" :cuenta-id="cuenta.id" :tipo="tipo" />

    <UModal v-model="modalEliminarCuenta">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">¿Eliminar esta cuenta?</h3>
        </template>
        <p class="text-sm" style="color: var(--ink-text-secondary)">
          Se eliminarán "{{ cuenta.nombre }}" y todos sus créditos y abonos. Esta acción no se puede deshacer.
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalEliminarCuenta = false">Cancelar</UButton>
            <UButton color="red" @click="eliminarCuenta">Eliminar</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
