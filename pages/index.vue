<script setup lang="ts">
const store = useAccountsStore()
const { formatDivisas } = useCurrency()
const { getEstado } = useAccountStatus()
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
</script>

<template>
  <div>
    <div class="mb-7">
      <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Panel general</p>
      <h1 class="font-display text-3xl mt-1" style="color: var(--ink-text)">Buenas, así va tu cartera</h1>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

    <div class="grid lg:grid-cols-3 gap-4 mb-6">
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="font-display text-lg" style="color: var(--ink-text)">Composición de la cartera</h2>
        </template>
        <SplitBar :cobrar="totalCobrar" :pagar="totalPagar" />
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-display text-lg" style="color: var(--ink-text)">Accesos rápidos</h2>
        </template>
        <div class="space-y-2">
          <UButton to="/cobrar" block color="amber" variant="soft" icon="i-heroicons-plus">Registrar crédito o abono</UButton>
          <UButton to="/pagar" block color="blue" variant="soft" icon="i-heroicons-plus">Registrar compra o pago</UButton>
          <UButton to="/ajustes" block color="gray" variant="ghost" icon="i-heroicons-cloud">Conectar Supabase</UButton>
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
  </div>
</template>
