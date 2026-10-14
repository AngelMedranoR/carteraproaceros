<script setup lang="ts">
import type { Cuenta, Credito } from '~/types'

const store = useAccountsStore()
const router = useRouter()
const toast = useToast()
const { formatDivisas } = useCurrency()
const { getEstado, obtenerRecordatoriosClientes } = useAccountStatus()

onMounted(() => store.hydrate())

const totalCobrar = computed(() => store.clientes.reduce((s, c) => s + saldoPendiente(c), 0))
const recordatoriosCobro = computed(() => obtenerRecordatoriosClientes(store.clientes))

const modalNuevo = ref(false)
const nombreNuevo = ref('')

const modalRecordatorio = ref(false)
const clienteRecordatorio = ref<Cuenta | null>(null)
const creditoRecordatorio = ref<Credito | null>(null)

function abrirRecordatorio(cliente: Cuenta, credito: Credito) {
  clienteRecordatorio.value = cliente
  creditoRecordatorio.value = credito
  modalRecordatorio.value = true
}

function onRegistrarCobro(cuentaId: string, credito: Credito) {
  modalRecordatorio.value = false
  const targetId = credito?.id || (typeof credito === 'string' ? credito : '')
  router.push(`/cobrar/${cuentaId}${targetId ? `?facturaId=${targetId}` : ''}`)
}

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
        <h1 class="font-display text-2xl sm:text-3xl mt-1" style="color: var(--ink-text)">Clientes</h1>
        <p class="mt-1 font-figures text-lg" style="color: var(--cobrar)">{{ formatDivisas(totalCobrar) }} pendientes</p>
      </div>
      <UButton color="amber" icon="i-heroicons-user-plus" @click="modalNuevo = true">Nuevo cliente</UButton>
    </div>

    <!-- Alerta preventiva / Recordatorios de cobro a clientes -->
    <div
      v-if="recordatoriosCobro.length > 0"
      class="mb-5 rounded-sm border p-4"
      style="border-color: var(--cobrar); background: var(--neutral-soft)"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--cobrar)" />
          <h3 class="font-display font-medium text-sm sm:text-base" style="color: var(--ink-text)">
            {{ recordatoriosCobro.length }} {{ recordatoriosCobro.length === 1 ? 'factura por cobrar para gestionar' : 'facturas por cobrar para gestionar' }}
          </h3>
        </div>
        <UBadge color="amber" variant="soft" size="xs">Recordatorios de Cobranza</UBadge>
      </div>

      <p class="text-xs sm:text-sm mb-3" style="color: var(--ink-text-secondary)">
        Las siguientes facturas emitidas a clientes están vencidas o próximas a vencer:
      </p>

      <ul class="divide-y divide-[var(--ink-border)]">
        <li
          v-for="alerta in recordatoriosCobro.slice(0, 5)"
          :key="alerta.credito.id"
          class="py-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <NuxtLink
              :to="`/cobrar/${alerta.cliente.id}`"
              class="font-medium text-sm hover:underline"
              style="color: var(--cobrar)"
            >
              {{ alerta.cliente.nombre }}
            </NuxtLink>
            <p class="text-xs" style="color: var(--ink-text-muted)">
              Factura {{ alerta.credito.numeroFactura || 'sin número' }}
              <span v-if="alerta.credito.descripcion"> · {{ alerta.credito.descripcion }}</span>
            </p>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <span class="font-figures font-semibold text-sm" style="color: var(--ink-text)">
              {{ formatDivisas(alerta.info.pendienteMonto) }}
            </span>
            <span
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-sm"
              :style="{
                color: alerta.info.color,
                background: `color-mix(in srgb, ${alerta.info.color} 15%, transparent)`,
              }"
            >
              <UIcon :name="alerta.info.icon" class="h-3 w-3" />
              {{ alerta.info.label }}
            </span>
            <UButton
              size="xs"
              color="amber"
              variant="outline"
              icon="i-heroicons-bell-alert"
              @click="abrirRecordatorio(alerta.cliente, alerta.credito)"
            >
              Recordar
            </UButton>
          </div>
        </li>
      </ul>
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

    <!-- Modal para enviar/copiar recordatorio de cobro -->
    <RecordatorioCobroModal
      v-model="modalRecordatorio"
      :cliente="clienteRecordatorio"
      :credito="creditoRecordatorio"
      @registrar-cobro="onRegistrarCobro"
    />
  </div>
</template>
