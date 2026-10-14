<script setup lang="ts">
import type { Credito } from '~/types'

const props = defineProps<{
  modelValue: boolean
  cuentaId: string
  nombreCuenta?: string
  creditoEditar?: Credito | null
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  guardado: []
}>()

const store = useAccountsStore()
const settings = useSettingsStore()
const toast = useToast()
const { getTodayDateString, addDaysToDate, diffDaysFromToday, formatDate, formatBolivares, formatDivisas } = useCurrency()

const esEdicion = computed(() => Boolean(props.creditoEditar))

const plazosPredefinidos = [
  { label: 'Contado (0d)', dias: 0 },
  { label: '7 días', dias: 7 },
  { label: '15 días', dias: 15 },
  { label: '30 días', dias: 30 },
  { label: '45 días', dias: 45 },
  { label: '60 días', dias: 60 },
]

const form = reactive({
  fecha: getTodayDateString(),
  plazoSeleccionado: 15,
  diasCredito: 15,
  fechaVencimiento: '',
  numeroFactura: '',
  montoDivisas: null as number | null,
  montoBolivares: null as number | null,
  tasaCambio: null as number | null,
  descripcion: '',
})

const enviando = ref(false)
const error = ref('')

function recalcularVencimientoPorDias(dias: number) {
  form.diasCredito = dias
  form.plazoSeleccionado = dias
  form.fechaVencimiento = addDaysToDate(form.fecha, dias)
}

function onFechaEmisionChange() {
  if (form.plazoSeleccionado !== -1) {
    form.fechaVencimiento = addDaysToDate(form.fecha, form.diasCredito)
  }
}

function onFechaVencimientoManual() {
  form.plazoSeleccionado = -1 // Modo personalizado
  const diff = diffDaysFromToday(form.fechaVencimiento)
  if (diff !== null) {
    const diffEmision = Math.round(
      (new Date(form.fechaVencimiento).getTime() - new Date(form.fecha).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    form.diasCredito = Math.max(0, diffEmision)
  }
}

function onDivisasInput() {
  if (form.montoDivisas && form.tasaCambio && form.tasaCambio > 0) {
    form.montoBolivares = Number((form.montoDivisas * form.tasaCambio).toFixed(2))
  } else if (form.montoDivisas && form.montoBolivares && !form.tasaCambio) {
    form.tasaCambio = Number((form.montoBolivares / form.montoDivisas).toFixed(4))
  }
}

function onBolivaresInput() {
  if (form.montoBolivares && form.tasaCambio && form.tasaCambio > 0) {
    form.montoDivisas = Number((form.montoBolivares / form.tasaCambio).toFixed(2))
  } else if (form.montoBolivares && form.montoDivisas && form.montoDivisas > 0) {
    form.tasaCambio = Number((form.montoBolivares / form.montoDivisas).toFixed(4))
  }
}

function onTasaInput() {
  if (form.tasaCambio && form.tasaCambio > 0) {
    if (form.montoDivisas) {
      form.montoBolivares = Number((form.montoDivisas * form.tasaCambio).toFixed(2))
    } else if (form.montoBolivares) {
      form.montoDivisas = Number((form.montoBolivares / form.tasaCambio).toFixed(2))
    }
  }
}

const diasRestantesVencimiento = computed(() => {
  return diffDaysFromToday(form.fechaVencimiento)
})

function sincronizarConProp() {
  if (props.creditoEditar) {
    form.fecha = props.creditoEditar.fecha || getTodayDateString()
    form.diasCredito = props.creditoEditar.diasCredito ?? 15
    const matchPreset = plazosPredefinidos.find((p) => p.dias === props.creditoEditar?.diasCredito)
    form.plazoSeleccionado = matchPreset ? matchPreset.dias : -1
    form.fechaVencimiento = props.creditoEditar.fechaVencimiento || addDaysToDate(form.fecha, form.diasCredito)
    form.numeroFactura = props.creditoEditar.numeroFactura || ''
    form.montoDivisas = props.creditoEditar.montoDivisas ?? null
    form.montoBolivares = props.creditoEditar.montoBolivares ?? null
    form.tasaCambio = props.creditoEditar.tasaCambio ?? null
    form.descripcion = props.creditoEditar.descripcion || ''
  } else {
    const hoy = getTodayDateString()
    const defaultDias = settings.diasCreditoPorDefecto || 15
    form.fecha = hoy
    form.plazoSeleccionado = defaultDias
    form.diasCredito = defaultDias
    form.fechaVencimiento = addDaysToDate(hoy, defaultDias)
    form.numeroFactura = ''
    form.montoDivisas = null
    form.montoBolivares = null
    form.tasaCambio = null
    form.descripcion = ''
  }
  error.value = ''
}

watch(
  () => [props.modelValue, props.creditoEditar],
  ([open]) => {
    if (open) sincronizarConProp()
  },
  { immediate: true }
)

function cerrar() {
  emit('update:modelValue', false)
}

function guardar() {
  error.value = ''
  if (!form.fecha) {
    error.value = 'Por favor indica la fecha de la factura.'
    return
  }
  const montoDivisas = Number(form.montoDivisas)
  if (!montoDivisas || montoDivisas <= 0) {
    error.value = 'El monto en divisas (USD) debe ser mayor a cero.'
    return
  }

  const montoBolivares =
    form.montoBolivares === null || form.montoBolivares === ('' as any)
      ? null
      : Number(form.montoBolivares)
  const tasaCambio =
    form.tasaCambio === null || form.tasaCambio === ('' as any)
      ? null
      : Number(form.tasaCambio)

  enviando.value = true
  if (esEdicion.value && props.creditoEditar) {
    store.actualizarCredito(props.cuentaId, props.creditoEditar.id, {
      fecha: form.fecha,
      numeroFactura: form.numeroFactura.trim(),
      montoDivisas,
      montoBolivares,
      tasaCambio,
      fechaVencimiento: form.fechaVencimiento || null,
      diasCredito: form.diasCredito,
      descripcion: form.descripcion.trim(),
    })
    toast.add({
      title: 'Factura actualizada',
      description: `Factura ${form.numeroFactura || 'sin número'} modificada correctamente`,
      icon: 'i-heroicons-check-circle',
      color: 'blue',
    })
  } else {
    store.agregarCredito(props.cuentaId, {
      fecha: form.fecha,
      numeroFactura: form.numeroFactura.trim(),
      montoDivisas,
      montoBolivares,
      tasaCambio,
      fechaVencimiento: form.fechaVencimiento || null,
      diasCredito: form.diasCredito,
      descripcion: form.descripcion.trim(),
    })
    toast.add({
      title: 'Factura de proveedor registrada',
      description: `Factura ${form.numeroFactura || 'sin número'} por ${formatDivisas(montoDivisas)}. Vence: ${formatDate(form.fechaVencimiento)}`,
      icon: 'i-heroicons-check-circle',
      color: 'blue',
    })
  }
  enviando.value = false
  emit('guardado')
  cerrar()
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="cerrar">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-[var(--ink-border)]' }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm" style="background: var(--pagar-soft)">
            <UIcon :name="esEdicion ? 'i-heroicons-pencil-square' : 'i-heroicons-document-arrow-down'" class="h-5 w-5" style="color: var(--pagar)" />
          </div>
          <div class="min-w-0">
            <h3 class="font-display text-lg leading-tight" style="color: var(--ink-text)">
              {{ esEdicion ? 'Editar factura por pagar (proveedor)' : 'Nueva factura por pagar (proveedor)' }}
            </h3>
            <p v-if="nombreCuenta" class="text-xs truncate" style="color: var(--ink-text-muted)">
              Proveedor: <span class="font-medium" style="color: var(--ink-text)">{{ nombreCuenta }}</span>
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Fila: Fecha de emisión y N° Factura -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <UFormGroup label="Fecha de emisión" required>
            <UInput v-model="form.fecha" type="date" @change="onFechaEmisionChange" />
          </UFormGroup>
          <UFormGroup label="N° de factura de proveedor">
            <UInput v-model="form.numeroFactura" placeholder="Ej. F-22014" />
          </UFormGroup>
        </div>

        <!-- Sección de Plazo y Vencimiento -->
        <div class="rounded-sm border p-3 sm:p-4 space-y-3" style="border-color: var(--ink-border); background: var(--neutral-soft)">
          <div class="flex flex-wrap items-center justify-between gap-1">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--ink-text-secondary)">
              Plazo de crédito y vencimiento
            </p>
            <span
              v-if="diasRestantesVencimiento !== null"
              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm"
              :style="{
                background: diasRestantesVencimiento <= 0 ? 'var(--critical-soft)' : diasRestantesVencimiento <= 5 ? 'var(--cobrar-soft)' : 'var(--good-soft)',
                color: diasRestantesVencimiento <= 0 ? 'var(--status-critical)' : diasRestantesVencimiento <= 5 ? 'var(--status-warning)' : 'var(--status-good)',
              }"
            >
              <UIcon :name="diasRestantesVencimiento <= 0 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-calendar'" class="h-3.5 w-3.5" />
              {{ diasRestantesVencimiento < 0 ? `Vencida (${Math.abs(diasRestantesVencimiento)}d)` : diasRestantesVencimiento === 0 ? 'Vence hoy' : `Vence en ${diasRestantesVencimiento} días` }}
            </span>
          </div>

          <!-- Selector rápido de plazos -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="p in plazosPredefinidos"
              :key="p.dias"
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-sm border transition-colors"
              :style="
                form.plazoSeleccionado === p.dias
                  ? 'background: var(--pagar); color: white; border-color: var(--pagar)'
                  : 'background: var(--ink-surface); color: var(--ink-text-secondary); border-color: var(--ink-border)'
              "
              @click="recalcularVencimientoPorDias(p.dias)"
            >
              {{ p.label }}
            </button>
          </div>

          <!-- Campo de fecha de vencimiento específica -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <UFormGroup label="Fecha límite de pago (Vencimiento)">
              <UInput v-model="form.fechaVencimiento" type="date" @change="onFechaVencimientoManual" />
            </UFormGroup>
            <UFormGroup label="Días de crédito concedidos">
              <UInput
                v-model.number="form.diasCredito"
                type="number"
                min="0"
                placeholder="15"
                @input="recalcularVencimientoPorDias(Number(form.diasCredito || 0))"
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Fila de Montos y Tasa -->
        <div class="rounded-sm border p-3 sm:p-4 space-y-3" style="border-color: var(--ink-border); background: var(--neutral-soft)">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--ink-text-secondary)">
              Montos y Tasa de Cambio
            </p>
            <span class="text-[11px]" style="color: var(--ink-text-muted)">Conversión automática</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <UFormGroup label="Monto en divisas (USD)" required>
              <UInput
                v-model.number="form.montoDivisas"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                @input="onDivisasInput"
              />
            </UFormGroup>

            <UFormGroup label="Tasa de cambio (Bs/$)">
              <UInput
                v-model.number="form.tasaCambio"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 45.50"
                @input="onTasaInput"
              />
            </UFormGroup>

            <UFormGroup label="Monto en bolívares">
              <UInput
                v-model.number="form.montoBolivares"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                @input="onBolivaresInput"
              />
            </UFormGroup>
          </div>

          <p v-if="form.montoBolivares && form.tasaCambio" class="text-xs" style="color: var(--ink-text-secondary)">
            Facturado: <span class="font-figures font-medium">{{ formatDivisas(form.montoDivisas) }}</span> a tasa de
            <span class="font-figures font-medium">{{ form.tasaCambio }} Bs/$</span> =
            <span class="font-figures font-medium">{{ formatBolivares(form.montoBolivares) }}</span>
          </p>
        </div>

        <!-- Descripción / Concepto -->
        <UFormGroup label="Concepto / detalle de la compra (opcional)">
          <UInput v-model="form.descripcion" placeholder="Ej. Bobinas de acero galvanizado, perfiles IPN..." />
        </UFormGroup>

        <p v-if="error" class="text-sm font-medium" style="color: var(--status-critical)">{{ error }}</p>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <UButton color="gray" variant="ghost" class="w-full sm:w-auto justify-center" @click="cerrar">Cancelar</UButton>
          <UButton color="blue" :loading="enviando" class="w-full sm:w-auto justify-center" @click="guardar">
            {{ esEdicion ? 'Guardar cambios' : 'Guardar factura de proveedor' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
