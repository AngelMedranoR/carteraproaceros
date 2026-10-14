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
const { getTodayDateString, addDaysToDate, diffDaysFromToday, formatBolivares, formatDivisas } = useCurrency()

const esEdicion = computed(() => Boolean(props.creditoEditar))

const plazosPredefinidos = [
  { label: 'Contado', dias: 0 },
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

function seleccionarPlazo(dias: number) {
  form.plazoSeleccionado = dias
  form.diasCredito = dias
  form.fechaVencimiento = addDaysToDate(form.fecha, dias)
}

function onFechaEmisionChange() {
  if (form.diasCredito !== null && form.diasCredito !== undefined) {
    form.fechaVencimiento = addDaysToDate(form.fecha, form.diasCredito)
  }
}

function onFechaVencimientoChange() {
  form.plazoSeleccionado = -1
  const diff = diffDaysFromToday(form.fechaVencimiento)
  if (diff !== null) {
    const diffEmision = Math.round(
      (new Date(form.fechaVencimiento).getTime() - new Date(form.fecha).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    form.diasCredito = Math.max(0, diffEmision)
  }
}

// Sincronización inteligente entre USD, Bs y Tasa
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
    const defaultDias = settings.diasCreditoCliente || 15
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
      diasCredito: form.diasCredito ?? null,
      descripcion: form.descripcion.trim(),
    })
    toast.add({
      title: 'Factura actualizada',
      description: `Factura ${form.numeroFactura || 'sin número'} modificada correctamente`,
      icon: 'i-heroicons-check-circle',
      color: 'amber',
    })
  } else {
    store.agregarCredito(props.cuentaId, {
      fecha: form.fecha,
      numeroFactura: form.numeroFactura.trim(),
      montoDivisas,
      montoBolivares,
      tasaCambio,
      fechaVencimiento: form.fechaVencimiento || null,
      diasCredito: form.diasCredito ?? null,
      descripcion: form.descripcion.trim(),
    })
    toast.add({
      title: 'Factura por cobrar registrada',
      description: `Factura ${form.numeroFactura || 'sin número'} por ${formatDivisas(montoDivisas)}`,
      icon: 'i-heroicons-check-circle',
      color: 'amber',
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
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm" style="background: var(--cobrar-soft)">
            <UIcon :name="esEdicion ? 'i-heroicons-pencil-square' : 'i-heroicons-document-plus'" class="h-5 w-5" style="color: var(--cobrar)" />
          </div>
          <div class="min-w-0">
            <h3 class="font-display text-lg leading-tight" style="color: var(--ink-text)">
              {{ esEdicion ? 'Editar factura por cobrar' : 'Nueva factura por cobrar' }}
            </h3>
            <p v-if="nombreCuenta" class="text-xs truncate" style="color: var(--ink-text-muted)">
              Cliente: <span class="font-medium" style="color: var(--ink-text)">{{ nombreCuenta }}</span>
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Fila: Fecha de Emisión y N° Factura -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <UFormGroup label="Fecha de emisión" required>
            <UInput v-model="form.fecha" type="date" @change="onFechaEmisionChange" />
          </UFormGroup>
          <UFormGroup label="N° de factura / control">
            <UInput v-model="form.numeroFactura" placeholder="Ej. 31022" />
          </UFormGroup>
        </div>

        <!-- Plazo de Cobro y Fecha de Vencimiento -->
        <div class="rounded-sm border p-3 sm:p-4 space-y-3" style="border-color: var(--ink-border); background: var(--neutral-soft)">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" style="color: var(--cobrar)" />
              <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--ink-text-secondary)">
                Plazo y Recordatorio de Cobro
              </p>
            </div>
            <!-- Badge con cuenta regresiva -->
            <span
              v-if="diasRestantesVencimiento !== null"
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-sm"
              :style="{
                background:
                  diasRestantesVencimiento < 0
                    ? 'var(--critical-soft)'
                    : diasRestantesVencimiento === 0
                    ? 'var(--warning-soft)'
                    : 'var(--cobrar-soft)',
                color:
                  diasRestantesVencimiento < 0
                    ? 'var(--status-critical)'
                    : diasRestantesVencimiento === 0
                    ? 'var(--status-warning)'
                    : 'var(--cobrar)',
              }"
            >
              <UIcon
                :name="diasRestantesVencimiento <= 0 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-clock'"
                class="h-3 w-3"
              />
              {{
                diasRestantesVencimiento < 0
                  ? `Vencida hace ${Math.abs(diasRestantesVencimiento)} días`
                  : diasRestantesVencimiento === 0
                  ? 'Vence hoy'
                  : `Vence en ${diasRestantesVencimiento} días`
              }}
            </span>
          </div>

          <!-- Presets de Plazo -->
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="p in plazosPredefinidos"
              :key="p.dias"
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-sm border transition-colors"
              :style="
                form.plazoSeleccionado === p.dias
                  ? 'background: var(--cobrar); color: white; border-color: var(--cobrar)'
                  : 'background: var(--ink-surface); color: var(--ink-text-secondary); border-color: var(--ink-border)'
              "
              @click="seleccionarPlazo(p.dias)"
            >
              {{ p.label }}
            </button>
          </div>

          <!-- Input de Fecha de Vencimiento y Días Calculados -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <UFormGroup label="Fecha límite de cobro">
              <UInput v-model="form.fechaVencimiento" type="date" @change="onFechaVencimientoChange" />
            </UFormGroup>
            <UFormGroup label="Días concedidos de crédito">
              <UInput
                v-model.number="form.diasCredito"
                type="number"
                min="0"
                placeholder="15"
                @input="seleccionarPlazo(Number(form.diasCredito) || 0)"
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
            Resumen: <span class="font-figures font-medium">{{ formatDivisas(form.montoDivisas) }}</span> a tasa de
            <span class="font-figures font-medium">{{ form.tasaCambio }} Bs/$</span> =
            <span class="font-figures font-medium">{{ formatBolivares(form.montoBolivares) }}</span>
          </p>
        </div>

        <!-- Descripción / Concepto -->
        <UFormGroup label="Descripción o concepto (opcional)">
          <UInput v-model="form.descripcion" placeholder="Ej. Perfiles de acero estructural, láminas..." />
        </UFormGroup>

        <p v-if="error" class="text-sm font-medium" style="color: var(--status-critical)">{{ error }}</p>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <UButton color="gray" variant="ghost" class="w-full sm:w-auto justify-center" @click="cerrar">Cancelar</UButton>
          <UButton color="amber" :loading="enviando" class="w-full sm:w-auto justify-center" @click="guardar">
            {{ esEdicion ? 'Guardar cambios' : 'Guardar factura' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
