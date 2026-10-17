<script setup lang="ts">
import type { ConsolidacionResultado } from '~/types'

const props = defineProps<{ tipo: 'cliente' | 'proveedor' }>()

const store = useAccountsStore()
const settingsStore = useSettingsStore()
const sync = useSupabaseSync()
const { parseWorkbook, exportarCuentas, consolidarImportacion } = useExcel()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const cargando = ref(false)
const guardando = ref(false)
const pendiente = ref<ConsolidacionResultado | null>(null)
const nombreArchivo = ref('')

const cuentasActuales = computed(() =>
  props.tipo === 'cliente' ? store.clientes : store.proveedores
)
const etiqueta = props.tipo === 'cliente' ? 'clientes' : 'proveedores'
const etiquetaSingular = props.tipo === 'cliente' ? 'cliente' : 'proveedor'

onMounted(() => {
  store.hydrate()
  settingsStore.hydrate()
})

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
      // Consolidar de forma inteligente contra los datos actuales del store
      const consolidado = consolidarImportacion(
        resultado.cuentas,
        store.cuentas,
        props.tipo,
        resultado.hojasOmitidas
      )
      pendiente.value = consolidado
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

async function confirmarImportacion() {
  if (!pendiente.value) return
  guardando.value = true
  const info = pendiente.value

  try {
    settingsStore.hydrate()
    store.hydrate()

    // 1. Guardar estado consolidado en Pinia y localStorage
    store.aplicarImportacionConsolidada(info.cuentasConsolidadas)

    // 2. Si no estaba marcado como conectado pero hay credenciales, probar conexión
    if (!settingsStore.connected) {
      await sync.probarConexion()
    }

    // 3. Si Supabase está conectado, guardar directamente en la base de datos en la nube
    let enNube = false
    let resumenNube = ''
    if (settingsStore.connected && settingsStore.tablesReady) {
      const cuentasParaUpsert = info.cuentasConsolidadas.filter((c) => c.tipo === props.tipo)
      const todosLosCreditos: Array<{ cuentaId: string; credito: any }> = []
      const todosLosAbonos: Array<{ cuentaId: string; abono: any }> = []

      for (const c of cuentasParaUpsert) {
        for (const cr of c.creditos) {
          todosLosCreditos.push({ cuentaId: c.id, credito: cr })
        }
        for (const ab of c.abonos) {
          todosLosAbonos.push({ cuentaId: c.id, abono: ab })
        }
      }

      const resDb = await sync.sincronizarLote({
        cuentas: cuentasParaUpsert,
        creditos: todosLosCreditos,
        abonos: todosLosAbonos,
      })

      if (resDb.ok) {
        enNube = true
        resumenNube = resDb.mensaje
      } else {
        toast.add({
          title: 'Error al sincronizar con la nube',
          description: resDb.mensaje,
          color: 'red',
          icon: 'i-heroicons-exclamation-triangle',
        })
      }
    }

    const { estadisticas } = info
    toast.add({
      title: enNube ? 'Sincronizado con la base de datos' : `${estadisticas.cuentasTotal} ${etiqueta} importados`,
      description: enNube
        ? `${resumenNube} Disponible en tiempo real en tu PC y teléfono.`
        : `${estadisticas.cuentasTotal} ${etiqueta} procesados (${estadisticas.creditosNuevos} facturas y ${estadisticas.abonosNuevos} abonos agregados, ${estadisticas.creditosExistentesOmitidos + estadisticas.abonosExistentesOmitidos} omitidos por ya existir).`,
      icon: enNube ? 'i-heroicons-cloud-arrow-up' : 'i-heroicons-check-circle',
      color: 'green',
    })

    pendiente.value = null
  } catch (err: any) {
    toast.add({
      title: 'Error durante la importación',
      description: err?.message || 'Ocurrió un error inesperado al guardar los datos.',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    guardando.value = false
  }
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
        <div class="flex items-center gap-2">
          <p class="font-medium" style="color: var(--ink-text)">Importar / exportar Excel</p>
          <span
            v-if="settingsStore.realtimeActivo"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
            style="background: color-mix(in srgb, var(--status-good) 15%, transparent); color: var(--status-good)"
          >
            <UIcon name="i-heroicons-bolt" class="h-3 w-3" />
            Base de datos en tiempo real
          </span>
          <span
            v-else-if="settingsStore.connected && settingsStore.tablesReady"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
            style="background: color-mix(in srgb, var(--status-good) 10%, transparent); color: var(--status-good)"
          >
            <UIcon name="i-heroicons-cloud" class="h-3 w-3" />
            Sincronización en la nube
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
            style="background: var(--ink-surface-sunken); color: var(--ink-text-muted)"
          >
            <UIcon name="i-heroicons-circle-stack" class="h-3 w-3" />
            Modo local
          </span>
        </div>
        <p class="text-sm mt-0.5" style="color: var(--ink-text-secondary)">
          Sube tu planilla .xlsx de {{ etiqueta }}. El sistema detecta y evita duplicar registros existentes, guardándolos automáticamente en la base de datos global.
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

    <!-- Vista previa con Desduplicación Inteligente -->
    <div
      v-if="pendiente"
      class="mt-4 rounded-sm border p-4 space-y-3"
      style="border-color: var(--ink-border); background: var(--neutral-soft)"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-document-check" class="h-5 w-5" style="color: var(--cobrar)" />
          <p class="text-sm font-semibold" style="color: var(--ink-text)">
            Análisis de "{{ nombreArchivo }}" completado
          </p>
        </div>
        <UBadge
          :color="settingsStore.connected && settingsStore.tablesReady ? 'green' : 'amber'"
          variant="soft"
          size="xs"
        >
          {{
            settingsStore.connected && settingsStore.tablesReady
              ? 'Listo para subir a Supabase'
              : 'Se guardará en este navegador'
          }}
        </UBadge>
      </div>

      <!-- Resumen de estadísticas de desduplicación -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <!-- Cuentas -->
        <div class="rounded p-2.5 border border-[var(--ink-border)] bg-[var(--ink-surface)]">
          <p class="text-xs uppercase font-medium" style="color: var(--ink-text-muted)">{{ etiqueta }}</p>
          <p class="text-lg font-bold font-figures mt-0.5" style="color: var(--ink-text)">
            {{ pendiente.estadisticas.cuentasTotal }}
          </p>
          <div class="mt-1 text-xs space-y-0.5" style="color: var(--ink-text-secondary)">
            <p v-if="pendiente.estadisticas.cuentasNuevas > 0" class="text-emerald-600 dark:text-emerald-400 font-medium">
              + {{ pendiente.estadisticas.cuentasNuevas }} {{ pendiente.estadisticas.cuentasNuevas === 1 ? 'nuevo' : 'nuevos' }}
            </p>
            <p v-if="pendiente.estadisticas.cuentasExistentes > 0" style="color: var(--ink-text-muted)">
              {{ pendiente.estadisticas.cuentasExistentes }} existentes conservados
            </p>
          </div>
        </div>

        <!-- Facturas (Créditos) -->
        <div class="rounded p-2.5 border border-[var(--ink-border)] bg-[var(--ink-surface)]">
          <p class="text-xs uppercase font-medium" style="color: var(--ink-text-muted)">Facturas (Créditos)</p>
          <p class="text-lg font-bold font-figures mt-0.5" style="color: var(--ink-text)">
            {{ pendiente.estadisticas.creditosTotal }}
          </p>
          <div class="mt-1 text-xs space-y-0.5" style="color: var(--ink-text-secondary)">
            <p v-if="pendiente.estadisticas.creditosNuevos > 0" class="text-emerald-600 dark:text-emerald-400 font-medium">
              + {{ pendiente.estadisticas.creditosNuevos }} nuevas a agregar
            </p>
            <p v-if="pendiente.estadisticas.creditosExistentesOmitidos > 0" class="text-amber-600 dark:text-amber-400">
              {{ pendiente.estadisticas.creditosExistentesOmitidos }} ya registradas (no duplicadas)
            </p>
          </div>
        </div>

        <!-- Abonos (Pagos) -->
        <div class="rounded p-2.5 border border-[var(--ink-border)] bg-[var(--ink-surface)]">
          <p class="text-xs uppercase font-medium" style="color: var(--ink-text-muted)">Abonos y Cobros</p>
          <p class="text-lg font-bold font-figures mt-0.5" style="color: var(--ink-text)">
            {{ pendiente.estadisticas.abonosTotal }}
          </p>
          <div class="mt-1 text-xs space-y-0.5" style="color: var(--ink-text-secondary)">
            <p v-if="pendiente.estadisticas.abonosNuevos > 0" class="text-emerald-600 dark:text-emerald-400 font-medium">
              + {{ pendiente.estadisticas.abonosNuevos }} nuevos a registrar
            </p>
            <p v-if="pendiente.estadisticas.abonosExistentesOmitidos > 0" class="text-amber-600 dark:text-amber-400">
              {{ pendiente.estadisticas.abonosExistentesOmitidos }} ya registrados (no duplicados)
            </p>
          </div>
        </div>
      </div>

      <!-- Detalle por cuenta desplegable -->
      <details class="text-xs pt-1" style="color: var(--ink-text-secondary)">
        <summary class="cursor-pointer font-medium hover:underline">
          Ver desglose detallado por {{ etiquetaSingular }} ({{ pendiente.cuentasAfectadas.length }})
        </summary>
        <div class="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          <div
            v-for="c in pendiente.cuentasAfectadas"
            :key="c.nombre"
            class="flex items-center justify-between p-1.5 rounded bg-[var(--ink-surface)] border border-[var(--ink-border)]"
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="h-1.5 w-1.5 rounded-full shrink-0"
                :style="{ background: c.esNueva ? 'var(--status-good)' : 'var(--cobrar)' }"
              />
              <span class="truncate font-medium" style="color: var(--ink-text)">{{ c.nombre }}</span>
              <span v-if="c.esNueva" class="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Nuevo
              </span>
            </div>
            <div class="text-[11px] shrink-0 text-right space-x-2">
              <span v-if="c.nuevasFacturas > 0" class="text-emerald-600 dark:text-emerald-400 font-mono">
                +{{ c.nuevasFacturas }} facturas
              </span>
              <span v-if="c.facturasOmitidas > 0" class="text-amber-600 dark:text-amber-400 font-mono">
                {{ c.facturasOmitidas }} existentes
              </span>
              <span v-if="c.nuevosAbonos > 0" class="text-blue-600 dark:text-blue-400 font-mono">
                +{{ c.nuevosAbonos }} abonos
              </span>
            </div>
          </div>
        </div>
      </details>

      <details v-if="pendiente.hojasOmitidas.length" class="text-xs" style="color: var(--ink-text-muted)">
        <summary class="cursor-pointer">{{ pendiente.hojasOmitidas.length }} hojas omitidas (resumen o sin movimientos)</summary>
        <ul class="mt-1 list-disc pl-4 space-y-0.5">
          <li v-for="h in pendiente.hojasOmitidas" :key="h">{{ h }}</li>
        </ul>
      </details>

      <!-- Mensaje informativo de sincronización -->
      <p
        v-if="settingsStore.connected && settingsStore.tablesReady"
        class="text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
      >
        <UIcon name="i-heroicons-bolt" class="h-4 w-4 shrink-0" />
        Al confirmar, se guardará en la base de datos de Supabase y aparecerá en tu teléfono al instante.
      </p>
      <p
        v-else
        class="text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
      >
        <UIcon name="i-heroicons-information-circle" class="h-4 w-4 shrink-0" />
        Aviso: Supabase no está conectado. Los datos se guardarán solo en este navegador. Para verlos en tu teléfono, vincula Supabase en Ajustes.
      </p>

      <div class="mt-3 flex gap-2 pt-1">
        <UButton
          size="sm"
          color="amber"
          :loading="guardando"
          icon="i-heroicons-check-circle"
          @click="confirmarImportacion"
        >
          Confirmar y sincronizar
        </UButton>
        <UButton size="sm" color="gray" variant="ghost" :disabled="guardando" @click="cancelarImportacion">
          Cancelar
        </UButton>
      </div>
    </div>
  </UCard>
</template>
