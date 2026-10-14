<script setup lang="ts">
const store = useAccountsStore()
const router = useRouter()
const toast = useToast()
const { formatDivisas } = useCurrency()

onMounted(() => store.hydrate())

const totalPagar = computed(() => store.proveedores.reduce((s, c) => s + saldoPendiente(c), 0))

const { getEstado, obtenerAlertasProveedores } = useAccountStatus()

const facturasAlertas = computed(() => obtenerAlertasProveedores(store.proveedores))

const modalNuevo = ref(false)
const nombreNuevo = ref('')

function crearProveedor() {
  const nombre = nombreNuevo.value.trim()
  if (!nombre) return
  const cuenta = store.crearCuenta(nombre, 'proveedor')
  modalNuevo.value = false
  nombreNuevo.value = ''
  toast.add({ title: 'Proveedor creado', icon: 'i-heroicons-check-circle', color: 'blue' })
  router.push(`/pagar/${cuenta.id}`)
}

function eliminar(id: string) {
  store.eliminarCuenta(id)
  toast.add({ title: 'Proveedor eliminado', icon: 'i-heroicons-trash', color: 'gray' })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Cuentas por pagar</p>
        <h1 class="font-display text-2xl sm:text-3xl mt-1" style="color: var(--ink-text)">Proveedores</h1>
        <p class="mt-1 font-figures text-lg" style="color: var(--pagar)">{{ formatDivisas(totalPagar) }} pendientes</p>
      </div>
      <UButton color="blue" icon="i-heroicons-truck" @click="modalNuevo = true">Nuevo proveedor</UButton>
    </div>

    <!-- Alerta preventiva de vencimiento de facturas de proveedores -->
    <div v-if="facturasAlertas.length > 0" class="mb-5 rounded-sm border p-4" style="border-color: var(--status-warning); background: var(--neutral-soft)">
      <div class="flex items-center gap-2 mb-2">
        <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--status-warning)" />
        <h3 class="font-display font-medium text-sm sm:text-base" style="color: var(--ink-text)">
          {{ facturasAlertas.length }} {{ facturasAlertas.length === 1 ? 'factura de proveedor por atender' : 'facturas de proveedores por atender' }}
        </h3>
      </div>
      <p class="text-xs sm:text-sm mb-3" style="color: var(--ink-text-secondary)">
        Facturas que requieren atención preventiva antes o durante su fecha límite de pago:
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <NuxtLink
          v-for="alerta in facturasAlertas.slice(0, 6)"
          :key="alerta.credito.id"
          :to="`/pagar/${alerta.proveedor.id}`"
          class="flex items-center justify-between p-2.5 rounded-sm border hover:border-[var(--pagar)] transition-colors"
          style="border-color: var(--ink-border); background: var(--ink-surface)"
        >
          <div class="min-w-0 pr-2">
            <p class="font-medium text-xs truncate" style="color: var(--ink-text)">{{ alerta.proveedor.nombre }}</p>
            <p class="text-[11px]" style="color: var(--ink-text-muted)">Factura {{ alerta.credito.numeroFactura || 'sin N°' }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-figures font-semibold text-xs" style="color: var(--pagar)">{{ formatDivisas(alerta.info.pendienteMonto) }}</p>
            <span class="text-[10px] font-medium" :style="{ color: alerta.info.color }">{{ alerta.info.label }}</span>
          </div>
        </NuxtLink>
      </div>
    </div>

    <div class="mb-5">
      <ImportExportPanel tipo="proveedor" />
    </div>

    <UCard>
      <AccountsTable :cuentas="store.proveedores" tipo="proveedor" @eliminar="eliminar" />
    </UCard>

    <UModal v-model="modalNuevo">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">Nuevo proveedor</h3>
        </template>
        <UFormGroup label="Nombre del proveedor" required>
          <UInput v-model="nombreNuevo" placeholder="Ej. Aceros del Caribe" autofocus @keyup.enter="crearProveedor" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalNuevo = false">Cancelar</UButton>
            <UButton color="blue" @click="crearProveedor">Crear</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
