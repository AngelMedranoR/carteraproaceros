<script setup lang="ts">
import type { Abono } from '~/types'

const props = defineProps<{
  modelValue: boolean
  cuentaId: string
  nombreCuenta?: string
  abonoEditar?: Abono | null
  facturaReferencia?: {
    numeroFactura?: string
    montoDivisas?: number
    montoBolivares?: number | null
    tasaCambio?: number | null
    pendienteMonto?: number
  } | null
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  guardado: []
}>()

const store = useAccountsStore()
const toast = useToast()
const { getTodayDateString, formatBolivares, formatDivisas } = useCurrency()

const esEdicion = computed(() => Boolean(props.abonoEditar))

const metodos = [
  'Transferencia bancaria',
  'Zelle proveedor',
  'Pago móvil',
  'Efectivo divisas',
  'Efectivo bolívares',
  'Binance',
  'Otro',
]

const form = reactive({
  fecha: getTodayDateString(),
  metodo: 'Transferencia bancaria',
  montoDivisas: null as number | null,
  montoBolivares: null as number | null,
  tasaCambio: null as number | null,
  referencia: '',
  comentario: '',
})

const enviando = ref(false)
const error = ref('')

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

function sincronizarConProp() {
  if (props.abonoEditar) {
    form.fecha = props.abonoEditar.fecha || getTodayDateString()
    form.montoDivisas = props.abonoEditar.montoDivisas ?? null
    form.montoBolivares = props.abonoEditar.montoBolivares ?? null
    form.tasaCambio = props.abonoEditar.tasaCambio ?? null

    const raw = props.abonoEditar.comentario || ''
    const partes = raw.split(' — ')
    const posibleMetodo = metodos.find((m) => partes[0]?.toLowerCase().includes(m.toLowerCase()))
    if (posibleMetodo) {
      form.metodo = posibleMetodo
      partes.shift()
    } else {
      form.metodo = 'Otro'
    }
    const posibleRef = partes.find((p) => p.startsWith('Ref: '))
    if (posibleRef) {
      form.referencia = posibleRef.replace('Ref: ', '').trim()
      const idx = partes.indexOf(posibleRef)
      if (idx !== -1) partes.splice(idx, 1)
    } else {
      form.referencia = ''
    }
    form.comentario = partes.join(' — ').trim()
  } else if (props.facturaReferencia) {
    form.fecha = getTodayDateString()
    form.metodo = 'Transferencia bancaria'
    const monto =
      (props.facturaReferencia.pendienteMonto !== undefined && props.facturaReferencia.pendienteMonto > 0)
        ? props.facturaReferencia.pendienteMonto
        : (props.facturaReferencia.montoDivisas ?? null)
    form.montoDivisas = monto
    form.tasaCambio = props.facturaReferencia.tasaCambio ?? null
    if (monto && form.tasaCambio && form.tasaCambio > 0) {
      form.montoBolivares = Number((monto * form.tasaCambio).toFixed(2))
    } else {
      form.montoBolivares = props.facturaReferencia.montoBolivares ?? null
    }
    const num = props.facturaReferencia.numeroFactura ? String(props.facturaReferencia.numeroFactura).trim() : ''
    form.referencia = num ? `Factura ${num}` : ''
    form.comentario = num ? `Pago Factura N° ${num}` : 'Pago de factura'
  } else {
    form.fecha = getTodayDateString()
    form.metodo = 'Transferencia bancaria'
    form.montoDivisas = null
    form.montoBolivares = null
    form.tasaCambio = null
    form.referencia = ''
    form.comentario = ''
  }
  error.value = ''
}

watch(
  () => [props.modelValue, props.abonoEditar, props.facturaReferencia],
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
    error.value = 'Por favor indica la fecha del pago.'
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

  const detallePartes = [
    form.metodo,
    form.referencia.trim() ? `Ref: ${form.referencia.trim()}` : null,
    form.comentario.trim() || null,
  ].filter(Boolean)

  enviando.value = true
  if (esEdicion.value && props.abonoEditar) {
    store.actualizarAbono(props.cuentaId, props.abonoEditar.id, {
      fecha: form.fecha,
      montoDivisas,
      montoBolivares,
      tasaCambio,
      comentario: detallePartes.join(' — '),
    })
    toast.add({
      title: 'Pago actualizado',
      description: `Pago de ${formatDivisas(montoDivisas)} modificado correctamente`,
      icon: 'i-heroicons-check-circle',
      color: 'blue',
    })
  } else {
    store.agregarAbono(props.cuentaId, {
      fecha: form.fecha,
      montoDivisas,
      montoBolivares,
      tasaCambio,
      comentario: detallePartes.join(' — '),
    })
    toast.add({
      title: 'Pago a proveedor registrado',
      description: `Pago de ${formatDivisas(montoDivisas)} registrado`,
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
            <UIcon :name="esEdicion ? 'i-heroicons-pencil-square' : 'i-heroicons-banknotes'" class="h-5 w-5" style="color: var(--pagar)" />
          </div>
          <div class="min-w-0">
            <h3 class="font-display text-lg leading-tight" style="color: var(--ink-text)">
              {{ esEdicion ? 'Editar pago a proveedor' : 'Registrar pago a proveedor' }}
            </h3>
            <p v-if="nombreCuenta" class="text-xs truncate" style="color: var(--ink-text-muted)">
              Proveedor: <span class="font-medium" style="color: var(--ink-text)">{{ nombreCuenta }}</span>
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Banner informativo si viene asociado a una factura específica -->
        <div
          v-if="facturaReferencia && !esEdicion"
          class="rounded-sm p-2.5 text-xs border flex flex-wrap items-center justify-between gap-2"
          style="background: var(--pagar-soft); border-color: color-mix(in srgb, var(--pagar) 40%, transparent)"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="h-4 w-4 shrink-0" style="color: var(--pagar)" />
            <span class="font-medium" style="color: var(--ink-text)">
              Pago para Factura {{ facturaReferencia.numeroFactura ? `#${facturaReferencia.numeroFactura}` : 'sin número' }}
            </span>
          </div>
          <span class="font-figures font-semibold text-xs" style="color: var(--pagar)">
            {{
              (facturaReferencia.pendienteMonto !== undefined && facturaReferencia.pendienteMonto > 0)
                ? `Saldo pendiente: ${formatDivisas(facturaReferencia.pendienteMonto)}`
                : `Monto factura: ${formatDivisas(facturaReferencia.montoDivisas || 0)}`
            }}
          </span>
        </div>

        <!-- Fila: Fecha y Método -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <UFormGroup label="Fecha del pago" required>
            <UInput v-model="form.fecha" type="date" />
          </UFormGroup>
          <UFormGroup label="Método de pago" required>
            <USelectMenu v-model="form.metodo" :options="metodos" />
          </UFormGroup>
        </div>

        <!-- Fila de Montos y Tasa -->
        <div class="rounded-sm border p-3 sm:p-4 space-y-3" style="border-color: var(--ink-border); background: var(--neutral-soft)">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--ink-text-secondary)">
              Montos y Tasa de Pago
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
                placeholder="Ej. 44.50"
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
            Pagado: <span class="font-figures font-medium">{{ formatDivisas(form.montoDivisas) }}</span> a tasa de
            <span class="font-figures font-medium">{{ form.tasaCambio }} Bs/$</span> =
            <span class="font-figures font-medium">{{ formatBolivares(form.montoBolivares) }}</span>
          </p>
        </div>

        <!-- Referencia bancaria y notas -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <UFormGroup label="N° Referencia / Soporte de pago">
            <UInput v-model="form.referencia" placeholder="Ej. #902144 / Banesco mercantil" />
          </UFormGroup>
          <UFormGroup label="Nota o concepto (opcional)">
            <UInput v-model="form.comentario" placeholder="Ej. Pago parcial factura F-22014" />
          </UFormGroup>
        </div>

        <p v-if="error" class="text-sm font-medium" style="color: var(--status-critical)">{{ error }}</p>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <UButton color="gray" variant="ghost" class="w-full sm:w-auto justify-center" @click="cerrar">Cancelar</UButton>
          <UButton color="blue" :loading="enviando" class="w-full sm:w-auto justify-center" @click="guardar">
            {{ esEdicion ? 'Guardar cambios' : 'Guardar pago a proveedor' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
