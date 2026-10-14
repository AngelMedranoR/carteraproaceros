<script setup lang="ts">
import type { Cuenta, Credito } from '~/types'

const store = useAccountsStore()
const { formatDivisas } = useCurrency()
const { getEstado, obtenerAlertasProveedores, obtenerRecordatoriosClientes } = useAccountStatus()
const { colors } = useChartTheme()

onMounted(() => store.hydrate())

const totalCobrar = computed(() => store.clientes.reduce((s, c) => s + saldoPendiente(c), 0))
const totalPagar = computed(() => store.proveedores.reduce((s, c) => s + saldoPendiente(c), 0))
const saldoNeto = computed(() => totalCobrar.value - totalPagar.value)

const vencidasCobrar = computed(() => store.clientes.filter((c) => getEstado(c) === 'vencido'))
const vencidasPagar = computed(() => store.proveedores.filter((c) => getEstado(c) === 'vencido'))

const topDeudores = computed(() =>
  [...store.clientes]
    .map((c) => ({ label: c.nombre, value: saldoPendiente(c) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
)

const topAcreedores = computed(() =>
  [...store.proveedores]
    .map((c) => ({ label: c.nombre, value: saldoPendiente(c) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
)

const serieCobrar = computed(() => useMonthlySeries(store.clientes))
const seriePagar = computed(() => useMonthlySeries(store.proveedores))
const facturasPorPagarAlertas = computed(() =>
  obtenerAlertasProveedores(store.proveedores)
)
const recordatoriosCobroClientes = computed(() =>
  obtenerRecordatoriosClientes(store.clientes)
)

const modalRecordatorio = ref(false)
const clienteRecordatorio = ref<Cuenta | null>(null)
const creditoRecordatorio = ref<Credito | null>(null)

const router = useRouter()

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
</script>

<template>
  <div>
    <div class="mb-7">
      <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Panel general</p>
      <h1 class="font-display text-2xl sm:text-3xl mt-1" style="color: var(--ink-text)">Buenas, así va tu cartera</h1>
    </div>

    <!-- KPIs con ajuste responsive para móviles -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
      <KpiCard label="Por cobrar" :value="formatDivisas(totalCobrar)" icon="i-heroicons-arrow-down-left" tone="cobrar" :hint="`${store.clientes.length} clientes`" />
      <KpiCard label="Por pagar" :value="formatDivisas(totalPagar)" icon="i-heroicons-arrow-up-right" tone="pagar" :hint="`${store.proveedores.length} proveedores`" />
      <KpiCard
        label="Saldo neto"
        :value="formatDivisas(saldoNeto)"
        icon="i-heroicons-scale"
        :tone="saldoNeto >= 0 ? 'good' : 'critical'"
        hint="Cobrar − pagar"
      />
      <KpiCard
        label="Cuentas vencidas"
        :value="String(vencidasCobrar.length + vencidasPagar.length)"
        icon="i-heroicons-exclamation-triangle"
        tone="critical"
        :hint="`${vencidasCobrar.length} clientes · ${vencidasPagar.length} proveedores`"
      />
    </div>

    <!-- Recordatorios de Cobranza a Clientes (Cuentas por Cobrar) -->
    <div v-if="recordatoriosCobroClientes.length > 0" class="mb-6">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--cobrar)" />
              <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">
                Recordatorios de cobranza a clientes
              </h2>
            </div>
            <UBadge color="amber" variant="soft" size="sm">
              {{ recordatoriosCobroClientes.length }} {{ recordatoriosCobroClientes.length === 1 ? 'por cobrar' : 'por cobrar' }}
            </UBadge>
          </div>
        </template>

        <p class="text-xs sm:text-sm mb-3" style="color: var(--ink-text-secondary)">
          Las siguientes facturas emitidas a clientes están vencidas o próximas a su fecha límite de pago:
        </p>

        <ul class="divide-y divide-[var(--ink-border)]">
          <li
            v-for="alerta in recordatoriosCobroClientes.slice(0, 5)"
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
                class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm"
                :style="{
                  color: alerta.info.color,
                  background: `color-mix(in srgb, ${alerta.info.color} 15%, transparent)`,
                }"
              >
                <UIcon :name="alerta.info.icon" class="h-3.5 w-3.5" />
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

        <div v-if="recordatoriosCobroClientes.length > 5" class="mt-3 text-right">
          <NuxtLink to="/cobrar" class="text-xs font-medium hover:underline" style="color: var(--cobrar)">
            Ver todas las facturas de clientes →
          </NuxtLink>
        </div>
      </UCard>
    </div>

    <!-- Alertas de facturas por pagar próximas a vencer o vencidas -->
    <div v-if="facturasPorPagarAlertas.length > 0" class="mb-6">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--pagar)" />
              <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">
                Alertas de facturas por pagar a proveedores
              </h2>
            </div>
            <UBadge color="red" variant="soft" size="sm">
              {{ facturasPorPagarAlertas.length }} {{ facturasPorPagarAlertas.length === 1 ? 'por atender' : 'por atender' }}
            </UBadge>
          </div>
        </template>

        <p class="text-xs sm:text-sm mb-3" style="color: var(--ink-text-secondary)">
          Las siguientes facturas de compras a proveedores están vencidas o próximas a vencer:
        </p>

        <ul class="divide-y divide-[var(--ink-border)]">
          <li
            v-for="alerta in facturasPorPagarAlertas.slice(0, 5)"
            :key="alerta.credito.id"
            class="py-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div class="min-w-0">
              <NuxtLink
                :to="`/pagar/${alerta.proveedor.id}`"
                class="font-medium text-sm hover:underline"
                style="color: var(--pagar)"
              >
                {{ alerta.proveedor.nombre }}
              </NuxtLink>
              <p class="text-xs" style="color: var(--ink-text-muted)">
                Factura {{ alerta.credito.numeroFactura || 'sin número' }}
                <span v-if="alerta.credito.descripcion"> · {{ alerta.credito.descripcion }}</span>
              </p>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span class="font-figures font-semibold text-sm" style="color: var(--ink-text)">
                {{ formatDivisas(alerta.info.pendienteMonto) }}
              </span>
              <span
                class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm"
                :style="{
                  color: alerta.info.color,
                  background: `color-mix(in srgb, ${alerta.info.color} 15%, transparent)`,
                }"
              >
                <UIcon :name="alerta.info.icon" class="h-3.5 w-3.5" />
                {{ alerta.info.label }}
              </span>
            </div>
          </li>
        </ul>

        <div v-if="facturasPorPagarAlertas.length > 5" class="mt-3 text-right">
          <NuxtLink to="/pagar" class="text-xs font-medium hover:underline" style="color: var(--pagar)">
            Ver todas las facturas de proveedores →
          </NuxtLink>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">Composición de la cartera</h2>
        </template>
        <SplitBar :cobrar="totalCobrar" :pagar="totalPagar" />
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-display text-base sm:text-lg" style="color: var(--ink-text)">Accesos rápidos</h2>
        </template>
        <div class="space-y-2">
          <UButton to="/cobrar" block color="amber" variant="soft" icon="i-heroicons-arrow-down-left">Ver Cuentas por Cobrar</UButton>
          <UButton to="/pagar" block color="blue" variant="soft" icon="i-heroicons-arrow-up-right">Ver Cuentas por Pagar</UButton>
          <UButton to="/ajustes" block color="gray" variant="ghost" icon="i-heroicons-cog-6-tooth">Configurar Alertas &amp; Sistema</UButton>
        </div>
      </UCard>
    </div>

    <div class="grid lg:grid-cols-2 gap-4 mb-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Ventas a crédito vs. cobros</h2>
            <span class="text-xs" style="color: var(--ink-text-muted)">últimos 6 meses</span>
          </div>
        </template>
        <TrendChart
          :labels="serieCobrar.labels"
          :series-a="serieCobrar.creditos"
          :series-b="serieCobrar.abonos"
          label-a="Créditos otorgados"
          label-b="Cobros recibidos"
          :color-a="colors.cobrar"
          :color-b="colors.good"
        />
      </UCard>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Compras a crédito vs. pagos</h2>
            <span class="text-xs" style="color: var(--ink-text-muted)">últimos 6 meses</span>
          </div>
        </template>
        <TrendChart
          :labels="seriePagar.labels"
          :series-a="seriePagar.creditos"
          :series-b="seriePagar.abonos"
          label-a="Compras a crédito"
          label-b="Pagos realizados"
          :color-a="colors.pagar"
          :color-b="colors.good"
        />
      </UCard>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h2 class="font-display text-lg" style="color: var(--ink-text)">Mayores deudores</h2>
        </template>
        <TopAccountsChart v-if="topDeudores.length" :items="topDeudores" :color="colors.cobrar" />
        <p v-else class="text-sm py-8 text-center" style="color: var(--ink-text-muted)">Sin saldos pendientes por cobrar.</p>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-display text-lg" style="color: var(--ink-text)">Mayores acreedores</h2>
        </template>
        <TopAccountsChart v-if="topAcreedores.length" :items="topAcreedores" :color="colors.pagar" />
        <p v-else class="text-sm py-8 text-center" style="color: var(--ink-text-muted)">Sin saldos pendientes por pagar.</p>
      </UCard>
    </div>

    <!-- Modal para enviar/copiar recordatorio de cobro -->
    <RecordatorioCobroModal
      v-model="modalRecordatorio"
      :cliente="clienteRecordatorio"
      :credito="creditoRecordatorio"
      @registrar-cobro="onRegistrarCobro"
    />
  </div>
</template>
