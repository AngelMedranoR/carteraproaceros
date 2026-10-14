<script setup lang="ts">
const props = defineProps<{ tipo: 'cliente' | 'proveedor' }>()

import type { Credito, Abono } from '~/types'

const route = useRoute()
const router = useRouter()
const store = useAccountsStore()
const toast = useToast()
const { formatDivisas, formatBolivares, formatTasa, formatDate } = useCurrency()
const { getEstado, getEstadoFactura } = useAccountStatus()

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

// Modales separados por tipo
const modalFacturaCobrar = ref(false)
const modalCobroCliente = ref(false)
const modalFacturaPagar = ref(false)
const modalPagoProveedor = ref(false)
const modalRecordatorio = ref(false)

const creditoEditar = ref<Credito | null>(null)
const abonoEditar = ref<Abono | null>(null)
const creditoRecordatorio = ref<Credito | null>(null)
const facturaCobroRef = ref<{
  numeroFactura?: string
  montoDivisas?: number
  montoBolivares?: number | null
  tasaCambio?: number | null
  pendienteMonto?: number
} | null>(null)

function abrirRecordatorio(c: Credito) {
  creditoRecordatorio.value = c
  modalRecordatorio.value = true
}

function onRegistrarCobroDesdeRecordatorio(cuentaIdOrCredito: string | Credito, maybeCredito?: Credito) {
  let credito: Credito | undefined

  if (maybeCredito && typeof maybeCredito === 'object' && 'montoDivisas' in maybeCredito) {
    credito = maybeCredito
  } else if (cuentaIdOrCredito && typeof cuentaIdOrCredito === 'object' && 'montoDivisas' in cuentaIdOrCredito) {
    credito = cuentaIdOrCredito as Credito
  } else if (typeof cuentaIdOrCredito === 'string' && cuenta.value) {
    credito = cuenta.value.creditos.find((c) => c.id === cuentaIdOrCredito)
  }

  if (!credito && creditoRecordatorio.value) {
    credito = creditoRecordatorio.value
  }

  if (!credito) return

  const info = cuenta.value ? getEstadoFactura(credito, cuenta.value) : null
  const saldoPend = (info?.pendienteMonto !== undefined && info.pendienteMonto > 0)
    ? info.pendienteMonto
    : credito.montoDivisas

  facturaCobroRef.value = {
    numeroFactura: credito.numeroFactura ? String(credito.numeroFactura).trim() : '',
    montoDivisas: credito.montoDivisas,
    montoBolivares: credito.montoBolivares,
    tasaCambio: credito.tasaCambio,
    pendienteMonto: saldoPend,
  }
  abonoEditar.value = null
  modalCobroCliente.value = true
}

function onRegistrarPagoDesdeFactura(credito: Credito) {
  if (!credito) return
  const info = cuenta.value ? getEstadoFactura(credito, cuenta.value) : null
  const saldoPend = (info?.pendienteMonto !== undefined && info.pendienteMonto > 0)
    ? info.pendienteMonto
    : credito.montoDivisas

  facturaCobroRef.value = {
    numeroFactura: credito.numeroFactura ? String(credito.numeroFactura).trim() : '',
    montoDivisas: credito.montoDivisas,
    montoBolivares: credito.montoBolivares,
    tasaCambio: credito.tasaCambio,
    pendienteMonto: saldoPend,
  }
  abonoEditar.value = null
  modalPagoProveedor.value = true
}

// Limpiar facturaCobroRef al cerrar modales de cobro/pago
watch([modalCobroCliente, modalPagoProveedor], ([cOpen, pOpen]) => {
  if (!cOpen && !pOpen) {
    facturaCobroRef.value = null
  }
})

// Auto-abrir modal si la URL incluye ?facturaId=
watch(
  [() => route.query.facturaId, () => cuenta.value],
  ([facturaId, c]) => {
    if (facturaId && c) {
      const target = c.creditos.find((cr) => cr.id === String(facturaId))
      if (target) {
        if (props.tipo === 'cliente') {
          onRegistrarCobroDesdeRecordatorio(c.id, target)
        } else {
          onRegistrarPagoDesdeFactura(target)
        }
        router.replace({ query: { ...route.query, facturaId: undefined } })
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  store.hydrate()
})

function abrirModalCredito() {
  creditoEditar.value = null
  if (props.tipo === 'cliente') modalFacturaCobrar.value = true
  else modalFacturaPagar.value = true
}

function abrirModalAbono() {
  abonoEditar.value = null
  facturaCobroRef.value = null
  if (props.tipo === 'cliente') modalCobroCliente.value = true
  else modalPagoProveedor.value = true
}

function editarCredito(c: Credito) {
  creditoEditar.value = c
  if (props.tipo === 'cliente') modalFacturaCobrar.value = true
  else modalFacturaPagar.value = true
}

function editarAbono(a: Abono) {
  abonoEditar.value = a
  if (props.tipo === 'cliente') modalCobroCliente.value = true
  else modalPagoProveedor.value = true
}

function eliminarCredito(id: string) {
  if (!cuenta.value) return
  store.eliminarCredito(cuenta.value.id, id)
  toast.add({ title: 'Factura eliminada', color: 'gray', icon: 'i-heroicons-trash' })
}

function eliminarAbono(id: string) {
  if (!cuenta.value) return
  store.eliminarAbono(cuenta.value.id, id)
  toast.add({ title: 'Registro eliminado', color: 'gray', icon: 'i-heroicons-trash' })
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

  <div v-else class="space-y-6">
    <UButton :to="rutaBase" icon="i-heroicons-arrow-left" color="gray" variant="ghost" size="sm">
      {{ tipo === 'cliente' ? 'Volver a Clientes' : 'Volver a Proveedores' }}
    </UButton>

    <!-- Encabezado de la cuenta adaptable a móvil -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 class="font-display text-2xl sm:text-3xl break-words" style="color: var(--ink-text)">
            {{ cuenta.nombre }}
          </h1>
          <StatusBadge :estado="estado" />
        </div>
        <p class="font-figures text-2xl sm:text-3xl mt-2 font-semibold" :style="{ color: acento }">
          {{ formatDivisas(saldo) }}
        </p>
        <p class="text-xs sm:text-sm" style="color: var(--ink-text-muted)">Saldo pendiente total</p>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <UButton
          :color="colorBtn"
          :icon="tipo === 'cliente' ? 'i-heroicons-document-plus' : 'i-heroicons-document-arrow-down'"
          class="flex-1 sm:flex-none justify-center"
          @click="abrirModalCredito"
        >
          {{ tipo === 'cliente' ? '+ Factura por cobrar' : '+ Factura por pagar' }}
        </UButton>
        <UButton
          :color="colorBtn"
          variant="outline"
          icon="i-heroicons-banknotes"
          class="flex-1 sm:flex-none justify-center"
          @click="abrirModalAbono"
        >
          {{ tipo === 'cliente' ? '+ Registrar cobro' : '+ Registrar pago' }}
        </UButton>
        <UButton
          color="gray"
          variant="ghost"
          icon="i-heroicons-trash"
          title="Eliminar cuenta"
          @click="modalEliminarCuenta = true"
        />
      </div>
    </div>

    <!-- Columnas: Facturas vs Pagos -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Columna 1: Facturas / Créditos -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">
              {{ tipo === 'cliente' ? 'Facturas por cobrar (créditos)' : 'Facturas de compras (por pagar)' }}
            </h2>
            <span class="text-xs font-medium" style="color: var(--ink-text-muted)">
              {{ creditosOrdenados.length }} {{ creditosOrdenados.length === 1 ? 'factura' : 'facturas' }}
            </span>
          </div>
        </template>

        <div v-if="creditosOrdenados.length === 0" class="py-10 text-center text-sm" style="color: var(--ink-text-muted)">
          Sin facturas registradas.
        </div>

        <ul v-else class="ledger-rule -mt-1 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
          <li
            v-for="c in creditosOrdenados"
            :key="c.id"
            class="py-3 first:pt-0 flex items-start justify-between gap-3 group border-b border-[var(--ink-border)]/40 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <p class="text-sm font-semibold" style="color: var(--ink-text)">{{ formatDate(c.fecha) }}</p>
                <!-- Badge de estado y vencimiento para clientes y proveedores -->
                <span
                  v-if="getEstadoFactura(c, cuenta).estado !== 'en_plazo' || c.fechaVencimiento"
                  class="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-sm"
                  :style="{
                    color: getEstadoFactura(c, cuenta).color,
                    background: `color-mix(in srgb, ${getEstadoFactura(c, cuenta).color} 15%, transparent)`,
                  }"
                >
                  <UIcon :name="getEstadoFactura(c, cuenta).icon" class="h-3 w-3" />
                  {{ getEstadoFactura(c, cuenta).label }}
                </span>
              </div>

              <p class="text-xs mt-1" style="color: var(--ink-text-muted)">
                <span class="font-medium" style="color: var(--ink-text-secondary)">
                  Factura {{ c.numeroFactura || 'sin número' }}
                </span>
                <span v-if="c.montoBolivares">
                  · {{ formatBolivares(c.montoBolivares) }}
                </span>
                <span v-if="c.tasaCambio" class="font-figures">
                  (Tasa: {{ formatTasa(c.tasaCambio) }})
                </span>
              </p>

              <p v-if="c.descripcion" class="text-xs mt-0.5 truncate" style="color: var(--ink-text-secondary)">
                {{ c.descripcion }}
              </p>
            </div>

            <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span class="font-figures font-semibold text-sm" :style="{ color: acento }">
                {{ formatDivisas(c.montoDivisas) }}
              </span>
              <!-- Botón de recordatorio de cobro para clientes -->
              <UButton
                v-if="tipo === 'cliente' && getEstadoFactura(c, cuenta).estado !== 'pagada'"
                icon="i-heroicons-bell-alert"
                color="amber"
                variant="soft"
                size="2xs"
                title="Recordar cobro por WhatsApp"
                @click="abrirRecordatorio(c)"
              >
                Recordar
              </UButton>
              <!-- Botón directo para registrar cobro de la factura -->
              <UButton
                v-if="tipo === 'cliente' && getEstadoFactura(c, cuenta).estado !== 'pagada'"
                icon="i-heroicons-banknotes"
                color="amber"
                variant="ghost"
                size="2xs"
                title="Registrar cobro de esta factura"
                @click="onRegistrarCobroDesdeRecordatorio(cuenta.id, c)"
              >
                Cobrar
              </UButton>
              <!-- Botón directo para registrar pago de la factura a proveedor -->
              <UButton
                v-if="tipo === 'proveedor' && getEstadoFactura(c, cuenta).estado !== 'pagada'"
                icon="i-heroicons-banknotes"
                color="blue"
                variant="ghost"
                size="2xs"
                title="Registrar pago de esta factura"
                @click="onRegistrarPagoDesdeFactura(c)"
              >
                Pagar
              </UButton>
              <UButton
                icon="i-heroicons-pencil-square"
                color="gray"
                variant="ghost"
                size="2xs"
                title="Editar factura"
                class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                @click="editarCredito(c)"
              />
              <UButton
                icon="i-heroicons-x-mark"
                color="gray"
                variant="ghost"
                size="2xs"
                title="Eliminar factura"
                class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                @click="eliminarCredito(c.id)"
              />
            </div>
          </li>
        </ul>
      </UCard>

      <!-- Columna 2: Abonos / Pagos -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">
              {{ tipo === 'cliente' ? 'Cobranzas y abonos recibidos' : 'Pagos realizados' }}
            </h2>
            <span class="text-xs font-medium" style="color: var(--ink-text-muted)">
              {{ abonosOrdenados.length }} {{ abonosOrdenados.length === 1 ? 'pago' : 'pagos' }}
            </span>
          </div>
        </template>

        <div v-if="abonosOrdenados.length === 0" class="py-10 text-center text-sm" style="color: var(--ink-text-muted)">
          Sin cobros o pagos registrados.
        </div>

        <ul v-else class="ledger-rule -mt-1 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
          <li
            v-for="a in abonosOrdenados"
            :key="a.id"
            class="py-3 first:pt-0 flex items-start justify-between gap-3 group border-b border-[var(--ink-border)]/40 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold" style="color: var(--ink-text)">{{ formatDate(a.fecha) }}</p>
              <p class="text-xs mt-1" style="color: var(--ink-text-secondary)">
                {{ a.comentario || 'Abono registrado' }}
              </p>
              <p v-if="a.montoBolivares || a.tasaCambio" class="text-xs mt-0.5" style="color: var(--ink-text-muted)">
                <span v-if="a.montoBolivares">{{ formatBolivares(a.montoBolivares) }}</span>
                <span v-if="a.tasaCambio" class="font-figures"> · Tasa: {{ formatTasa(a.tasaCambio) }}</span>
              </p>
            </div>

            <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span class="font-figures font-semibold text-sm" style="color: var(--status-good)">
                {{ formatDivisas(a.montoDivisas) }}
              </span>
              <UButton
                icon="i-heroicons-pencil-square"
                color="gray"
                variant="ghost"
                size="2xs"
                title="Editar registro"
                class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                @click="editarAbono(a)"
              />
              <UButton
                icon="i-heroicons-x-mark"
                color="gray"
                variant="ghost"
                size="2xs"
                title="Eliminar registro"
                class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                @click="eliminarAbono(a.id)"
              />
            </div>
          </li>
        </ul>
      </UCard>
    </div>

    <!-- Modales específicos para Cuentas por Cobrar -->
    <template v-if="tipo === 'cliente'">
      <FacturaCobrarModal
        v-model="modalFacturaCobrar"
        :cuenta-id="cuenta.id"
        :nombre-cuenta="cuenta.nombre"
        :credito-editar="creditoEditar"
      />
      <CobroClienteModal
        v-model="modalCobroCliente"
        :cuenta-id="cuenta.id"
        :nombre-cuenta="cuenta.nombre"
        :abono-editar="abonoEditar"
        :factura-referencia="facturaCobroRef"
      />
      <RecordatorioCobroModal
        v-model="modalRecordatorio"
        :cliente="cuenta"
        :credito="creditoRecordatorio"
        @registrar-cobro="onRegistrarCobroDesdeRecordatorio"
      />
    </template>

    <!-- Modales específicos para Cuentas por Pagar -->
    <template v-else>
      <FacturaPagarModal
        v-model="modalFacturaPagar"
        :cuenta-id="cuenta.id"
        :nombre-cuenta="cuenta.nombre"
        :credito-editar="creditoEditar"
      />
      <PagoProveedorModal
        v-model="modalPagoProveedor"
        :cuenta-id="cuenta.id"
        :nombre-cuenta="cuenta.nombre"
        :abono-editar="abonoEditar"
        :factura-referencia="facturaCobroRef"
      />
    </template>

    <!-- Modal de confirmación para eliminar cuenta -->
    <UModal v-model="modalEliminarCuenta">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">¿Eliminar esta cuenta?</h3>
        </template>
        <p class="text-sm" style="color: var(--ink-text-secondary)">
          Se eliminarán "{{ cuenta.nombre }}" y todos sus registros de créditos y pagos. Esta acción no se puede deshacer.
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

