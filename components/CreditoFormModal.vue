<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; cuentaId: string; tipo: 'cliente' | 'proveedor' }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; guardado: [] }>()

const store = useAccountsStore()
const toast = useToast()

const { getTodayDateString } = useCurrency()
const hoy = getTodayDateString()
const form = reactive({
  fecha: hoy,
  numeroFactura: '',
  montoDivisas: null as number | null,
  montoBolivares: null as number | null,
})
const enviando = ref(false)
const error = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.fecha = hoy
      form.numeroFactura = ''
      form.montoDivisas = null
      form.montoBolivares = null
      error.value = ''
    }
  }
)

function cerrar() {
  emit('update:modelValue', false)
}

function guardar() {
  error.value = ''
  if (!form.fecha) {
    error.value = 'Indica la fecha de la factura.'
    return
  }
  const montoDivisas = Number(form.montoDivisas)
  const montoBolivares = form.montoBolivares === null || form.montoBolivares === ('' as any) ? null : Number(form.montoBolivares)
  if (!montoDivisas || montoDivisas <= 0) {
    error.value = 'El monto en divisas debe ser mayor a cero.'
    return
  }
  enviando.value = true
  store.agregarCredito(props.cuentaId, {
    fecha: form.fecha,
    numeroFactura: form.numeroFactura.trim(),
    montoDivisas,
    montoBolivares,
  })
  enviando.value = false
  toast.add({ title: 'Crédito registrado', icon: 'i-heroicons-check-circle', color: 'amber' })
  emit('guardado')
  cerrar()
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="cerrar">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-[var(--ink-border)]' }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-sm" style="background: var(--cobrar-soft)">
            <UIcon name="i-heroicons-document-plus" class="h-4 w-4" style="color: var(--cobrar)" />
          </div>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">Nuevo crédito (factura)</h3>
        </div>
      </template>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup label="Fecha de factura" required>
            <UInput v-model="form.fecha" type="date" />
          </UFormGroup>
          <UFormGroup label="N° de factura">
            <UInput v-model="form.numeroFactura" placeholder="Ej. 31022" />
          </UFormGroup>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup label="Monto en divisas (USD)" required>
            <UInput v-model.number="form.montoDivisas" type="number" step="0.01" min="0" placeholder="0.00" />
          </UFormGroup>
          <UFormGroup label="Monto en bolívares">
            <UInput v-model.number="form.montoBolivares" type="number" step="0.01" min="0" placeholder="Opcional" />
          </UFormGroup>
        </div>
        <p v-if="error" class="text-sm" style="color: var(--status-critical)">{{ error }}</p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="cerrar">Cancelar</UButton>
          <UButton color="amber" :loading="enviando" @click="guardar">Guardar crédito</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
