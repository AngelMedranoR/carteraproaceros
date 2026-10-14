<script setup lang="ts">
import type { Cuenta, Credito } from '~/types'

const props = defineProps<{
  modelValue: boolean
  cliente: Cuenta | null
  credito: Credito | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  registrarCobro: [cuentaId: string, credito: Credito]
}>()

const toast = useToast()
const { formatDivisas, formatBolivares, formatDate } = useCurrency()
const { getEstadoFactura, generarMensajeCobro, generarEnlaceWhatsApp } = useAccountStatus()

const mensaje = ref('')
const telefono = ref('')
const copiado = ref(false)

const info = computed(() => {
  if (!props.credito || !props.cliente) return null
  return getEstadoFactura(props.credito, props.cliente)
})

watch(
  () => [props.modelValue, props.credito, props.cliente],
  ([open]) => {
    if (open && props.cliente && props.credito) {
      mensaje.value = generarMensajeCobro(props.cliente, props.credito, info.value || undefined)
      copiado.value = false
    }
  },
  { immediate: true }
)

function cerrar() {
  emit('update:modelValue', false)
}

async function copiarTexto() {
  try {
    await navigator.clipboard.writeText(mensaje.value)
    copiado.value = true
    toast.add({
      title: 'Mensaje copiado al portapapeles',
      description: 'Listo para pegar en WhatsApp, correo o SMS.',
      color: 'amber',
      icon: 'i-heroicons-clipboard-document-check',
    })
    setTimeout(() => {
      copiado.value = false
    }, 2500)
  } catch {
    toast.add({
      title: 'No se pudo copiar automáticamente',
      description: 'Por favor selecciona el texto y cópialo manualmente.',
      color: 'yellow',
    })
  }
}

function abrirWhatsApp() {
  const url = generarEnlaceWhatsApp(mensaje.value, telefono.value)
  window.open(url, '_blank')
}

function iniciarRegistroCobro() {
  if (!props.cliente || !props.credito) return
  emit('registrarCobro', props.cliente.id, props.credito)
  cerrar()
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="cerrar">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-[var(--ink-border)]' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-amber-500/10">
              <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--cobrar)" />
            </div>
            <div>
              <h3 class="font-display text-lg leading-tight" style="color: var(--ink-text)">
                Recordatorio de cobro
              </h3>
              <p v-if="cliente" class="text-xs truncate" style="color: var(--ink-text-muted)">
                Cliente: <span class="font-medium" style="color: var(--ink-text)">{{ cliente.nombre }}</span>
              </p>
            </div>
          </div>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" size="sm" @click="cerrar" />
        </div>
      </template>

      <div v-if="cliente && credito" class="space-y-4">
        <!-- Ficha resumen de la factura -->
        <div class="rounded-sm border p-3.5 space-y-2 bg-[var(--ink-surface-sunken)] border-[var(--ink-border)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--ink-text-muted)">
                Factura {{ credito.numeroFactura || 'sin número' }}
              </p>
              <p class="text-xs" style="color: var(--ink-text-secondary)">
                Emitida el {{ formatDate(credito.fecha) }}
                <span v-if="credito.fechaVencimiento"> · Vence el {{ formatDate(credito.fechaVencimiento) }}</span>
              </p>
            </div>

            <div class="text-right">
              <p class="font-figures font-bold text-base" style="color: var(--cobrar)">
                {{ formatDivisas(credito.montoDivisas) }}
              </p>
              <p v-if="credito.montoBolivares" class="text-xs font-figures" style="color: var(--ink-text-muted)">
                {{ formatBolivares(credito.montoBolivares) }}
              </p>
            </div>
          </div>

          <div v-if="info" class="pt-1 flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm"
              :style="{
                color: info.color,
                background: `color-mix(in srgb, ${info.color} 15%, transparent)`,
              }"
            >
              <UIcon :name="info.icon" class="h-3.5 w-3.5" />
              {{ info.label }}
            </span>
          </div>
        </div>

        <!-- Teléfono de WhatsApp (opcional) -->
        <UFormGroup label="Número de WhatsApp o teléfono del cliente (opcional)">
          <UInput
            v-model="telefono"
            placeholder="Ej. 04141234567 o 584141234567"
            icon="i-heroicons-phone"
          />
        </UFormGroup>

        <!-- Mensaje redactado editable -->
        <UFormGroup label="Mensaje de recordatorio (puedes editarlo antes de enviar)">
          <UTextarea
            v-model="mensaje"
            :rows="5"
            class="text-xs sm:text-sm font-sans"
            placeholder="Escribe el mensaje de cobro..."
          />
        </UFormGroup>

        <!-- Acciones rápidas de cobranza -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <UButton
            :color="copiado ? 'green' : 'amber'"
            variant="solid"
            :icon="copiado ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
            class="justify-center"
            @click="copiarTexto"
          >
            {{ copiado ? '¡Mensaje copiado!' : 'Copiar mensaje' }}
          </UButton>

          <UButton
            color="green"
            variant="solid"
            icon="i-heroicons-chat-bubble-left-right"
            class="justify-center"
            @click="abrirWhatsApp"
          >
            Enviar por WhatsApp
          </UButton>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-between items-center gap-2">
          <UButton
            color="amber"
            variant="ghost"
            size="sm"
            icon="i-heroicons-credit-card"
            class="w-full sm:w-auto justify-center"
            @click="iniciarRegistroCobro"
          >
            Registrar cobro de esta factura
          </UButton>
          <UButton color="gray" variant="ghost" class="w-full sm:w-auto justify-center" @click="cerrar">
            Cerrar
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
