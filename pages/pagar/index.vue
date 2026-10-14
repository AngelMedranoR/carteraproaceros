<script setup lang="ts">
const store = useAccountsStore()
const router = useRouter()
const toast = useToast()
const { formatDivisas } = useCurrency()

onMounted(() => store.hydrate())

const totalPagar = computed(() => store.proveedores.reduce((s, c) => s + saldoPendiente(c), 0))

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
        <h1 class="font-display text-3xl mt-1" style="color: var(--ink-text)">Proveedores</h1>
        <p class="mt-1 font-figures text-lg" style="color: var(--pagar)">{{ formatDivisas(totalPagar) }} pendientes</p>
      </div>
      <UButton color="blue" icon="i-heroicons-truck" @click="modalNuevo = true">Nuevo proveedor</UButton>
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
