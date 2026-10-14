<script setup lang="ts">
const props = defineProps<{ tipo: 'cliente' | 'proveedor' }>()

const store = useAccountsStore()
const { parseWorkbook, exportarCuentas } = useExcel()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const cargando = ref(false)
const pendiente = ref<{ cuentas: any[]; hojasOmitidas: string[] } | null>(null)
const nombreArchivo = ref('')

const cuentasActuales = computed(() =>
  props.tipo === 'cliente' ? store.clientes : store.proveedores
)
const etiqueta = props.tipo === 'cliente' ? 'clientes' : 'proveedores'

function abrirSelector() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  nombreArchivo.value = file.name
  cargando.value = true
  try {
    const resultado = await parseWorkbook(file, props.tipo)
    if (resultado.cuentas.length === 0) {
      toast.add({
        title: 'No se encontraron cuentas',
        description: 'Revisa que el archivo tenga el formato esperado (hojas con CRÉDITOS / ABONOS).',
        color: 'red',
        icon: 'i-heroicons-exclamation-triangle',
      })
    } else {
      pendiente.value = resultado
    }
  } catch (err: any) {
    toast.add({
      title: 'No se pudo leer el archivo',
      description: err?.message || 'Verifica que sea un archivo .xlsx válido.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } finally {
    cargando.value = false
    input.value = ''
  }
}

function confirmarImportacion() {
  if (!pendiente.value) return
  store.reemplazarCuentasDeTipo(props.tipo, pendiente.value.cuentas)
  toast.add({
    title: `${pendiente.value.cuentas.length} ${etiqueta} importados`,
    description: pendiente.value.hojasOmitidas.length
      ? `Se omitieron ${pendiente.value.hojasOmitidas.length} hojas (ocultas o de resumen).`
      : undefined,
    icon: 'i-heroicons-check-circle',
    color: 'green',
  })
  pendiente.value = null
}

function cancelarImportacion() {
  pendiente.value = null
}

function exportar() {
  if (cuentasActuales.value.length === 0) {
    toast.add({ title: 'No hay datos para exportar', color: 'amber', icon: 'i-heroicons-information-circle' })
    return
  }
  exportarCuentas(cuentasActuales.value, props.tipo)
  toast.add({ title: 'Archivo Excel generado', icon: 'i-heroicons-arrow-down-tray', color: 'green' })
}
</script>

<template>
  <UCard>
    <div class="flex flex-col sm:flex-row sm:items-center gap-4">
      <div class="flex-1">
        <p class="font-medium" style="color: var(--ink-text)">Importar / exportar Excel</p>
        <p class="text-sm mt-0.5" style="color: var(--ink-text-secondary)">
          Sube tu archivo .xlsx con una hoja por {{ props.tipo === 'cliente' ? 'cliente' : 'proveedor' }}
          (columnas CRÉDITOS / ABONOS). Las hojas ocultas y de resumen se ignoran automáticamente.
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        <UButton
          icon="i-heroicons-arrow-up-tray"
          color="gray"
          variant="outline"
          :loading="cargando"
          @click="abrirSelector"
        >
          Importar
        </UButton>
        <UButton icon="i-heroicons-arrow-down-tray" color="gray" variant="outline" @click="exportar">
          Exportar
        </UButton>
      </div>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileChange" />
    </div>

    <div v-if="pendiente" class="mt-4 rounded-sm border p-4" style="border-color: var(--ink-border); background: var(--neutral-soft)">
      <p class="text-sm font-medium" style="color: var(--ink-text)">
        Se leyeron {{ pendiente.cuentas.length }} {{ etiqueta }} de "{{ nombreArchivo }}".
      </p>
      <p v-if="cuentasActuales.length" class="text-sm mt-1" style="color: var(--ink-text-secondary)">
        Esto reemplazará los {{ cuentasActuales.length }} {{ etiqueta }} que tienes actualmente cargados.
      </p>
      <details v-if="pendiente.hojasOmitidas.length" class="mt-2 text-xs" style="color: var(--ink-text-muted)">
        <summary class="cursor-pointer">{{ pendiente.hojasOmitidas.length }} hojas omitidas</summary>
        <ul class="mt-1 list-disc pl-4 space-y-0.5">
          <li v-for="h in pendiente.hojasOmitidas" :key="h">{{ h }}</li>
        </ul>
      </details>
      <div class="mt-3 flex gap-2">
        <UButton size="sm" color="amber" @click="confirmarImportacion">Confirmar importación</UButton>
        <UButton size="sm" color="gray" variant="ghost" @click="cancelarImportacion">Cancelar</UButton>
      </div>
    </div>
  </UCard>
</template>
