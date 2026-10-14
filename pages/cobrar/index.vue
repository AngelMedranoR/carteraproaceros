<script setup lang="ts">
const store = useAccountsStore()
const router = useRouter()
const toast = useToast()
const { formatDivisas } = useCurrency()

onMounted(() => store.hydrate())

const totalCobrar = computed(() => store.clientes.reduce((s, c) => s + saldoPendiente(c), 0))

const modalNuevo = ref(false)
const nombreNuevo = ref('')

function crearCliente() {
  const nombre = nombreNuevo.value.trim()
  if (!nombre) return
  const cuenta = store.crearCuenta(nombre, 'cliente')
  modalNuevo.value = false
  nombreNuevo.value = ''
  toast.add({ title: 'Cliente creado', icon: 'i-heroicons-check-circle', color: 'amber' })
  router.push(`/cobrar/${cuenta.id}`)
}

function eliminar(id: string) {
  store.eliminarCuenta(id)
  toast.add({ title: 'Cliente eliminado', icon: 'i-heroicons-trash', color: 'gray' })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Cuentas por cobrar</p>
        <h1 class="font-display text-3xl mt-1" style="color: var(--ink-text)">Clientes</h1>
        <p class="mt-1 font-figures text-lg" style="color: var(--cobrar)">{{ formatDivisas(totalCobrar) }} pendientes</p>
      </div>
      <UButton color="amber" icon="i-heroicons-user-plus" @click="modalNuevo = true">Nuevo cliente</UButton>
    </div>

    <div class="mb-5">
      <ImportExportPanel tipo="cliente" />
    </div>

    <UCard>
      <AccountsTable :cuentas="store.clientes" tipo="cliente" @eliminar="eliminar" />
    </UCard>

    <UModal v-model="modalNuevo">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">Nuevo cliente</h3>
        </template>
        <UFormGroup label="Nombre del cliente" required>
          <UInput v-model="nombreNuevo" placeholder="Ej. Ferretería El Progreso" autofocus @keyup.enter="crearCliente" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalNuevo = false">Cancelar</UButton>
            <UButton color="amber" @click="crearCliente">Crear</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
