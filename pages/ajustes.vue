<script setup lang="ts">
import QRCode from 'qrcode'

const settings = useSettingsStore()
const accounts = useAccountsStore()
const sync = useSupabaseSync()
const toast = useToast()

onMounted(() => {
  settings.hydrate()
  accounts.hydrate()
})

const probando = ref(false)
const sincronizando = ref(false)
const subiendo = ref(false)
const descargando = ref(false)
const modalSql = ref(false)
const modalVaciar = ref(false)
const modalDescargar = ref(false)
const modalVincular = ref(false)
const qrDataUrl = ref('')
const enlaceCopiado = ref(false)
const sqlCopiado = ref(false)

const enlaceMovil = computed(() => {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const u = encodeURIComponent(settings.url)
  const k = encodeURIComponent(settings.anonKey)
  return `${origin}/?s_url=${u}&s_key=${k}`
})

async function abrirModalVincular() {
  if (!settings.url || !settings.anonKey) {
    toast.add({
      title: 'Configura Supabase primero',
      description: 'Ingresa la URL y Anon Key para poder vincular tu teléfono.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(enlaceMovil.value, {
      width: 280,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    })
  } catch (e) {
    console.warn('Error al generar QR:', e)
  }
  modalVincular.value = true
}

async function copiarEnlaceMovil() {
  try {
    await navigator.clipboard.writeText(enlaceMovil.value)
    enlaceCopiado.value = true
    toast.add({
      title: 'Enlace de vinculación copiado',
      description: 'Pégalo o envíatelo por WhatsApp a tu teléfono para conectarlo automáticamente.',
      color: 'green',
      icon: 'i-heroicons-clipboard-document-check',
    })
    setTimeout(() => {
      enlaceCopiado.value = false
    }, 2500)
  } catch {
    toast.add({
      title: 'No se pudo copiar automáticamente',
      description: 'Por favor copia el enlace manualmente.',
      color: 'yellow',
    })
  }
}

async function probar() {
  probando.value = true
  const res = await sync.probarConexion()
  probando.value = false

  if (res.ok && res.tablesReady) {
    await sync.iniciarSuscripcionRealtime()
    toast.add({
      title: 'Conexión exitosa',
      description: 'Supabase está conectado, tablas listas y transmisión en tiempo real activa.',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    })
  } else if (res.ok && !res.tablesReady) {
    toast.add({
      title: 'Conectado · Faltan tablas',
      description: 'La clave es válida, pero aún no has ejecutado el script SQL en Supabase.',
      color: 'yellow',
      icon: 'i-heroicons-exclamation-triangle',
    })
  } else {
    toast.add({
      title: 'No se pudo conectar',
      description: res.mensaje,
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

async function sincronizarAhora() {
  sincronizando.value = true
  const res = await sync.sincronizar()
  sincronizando.value = false

  if (res.ok) {
    await sync.iniciarSuscripcionRealtime()
  }

  toast.add({
    title: res.ok ? 'Sincronización completada' : 'Error al sincronizar',
    description: res.mensaje,
    color: res.ok ? 'green' : 'red',
    icon: res.ok ? 'i-heroicons-arrow-path' : 'i-heroicons-exclamation-triangle',
  })
}

async function conectarRealtime() {
  await sync.iniciarSuscripcionRealtime()
  toast.add({
    title: 'Transmisión en tiempo real iniciada',
    description: 'Los cambios se reflejarán instantáneamente en todos los dispositivos conectados.',
    color: 'green',
    icon: 'i-heroicons-bolt',
  })
}

async function subirNube() {
  subiendo.value = true
  const res = await sync.subirASupabase()
  subiendo.value = false

  toast.add({
    title: res.ok ? 'Respaldo en la nube exitoso' : 'Error al respaldar',
    description: res.mensaje,
    color: res.ok ? 'green' : 'red',
    icon: res.ok ? 'i-heroicons-cloud-arrow-up' : 'i-heroicons-exclamation-triangle',
  })
}

async function descargarNube() {
  modalDescargar.value = false
  descargando.value = true
  const res = await sync.descargarDeSupabase()
  descargando.value = false

  if (res.ok) {
    await sync.iniciarSuscripcionRealtime()
  }

  toast.add({
    title: res.ok ? 'Datos restaurados de la nube' : 'Error al descargar',
    description: res.mensaje,
    color: res.ok ? 'green' : 'red',
    icon: res.ok ? 'i-heroicons-cloud-arrow-down' : 'i-heroicons-exclamation-triangle',
  })
}

async function desconectar() {
  await sync.detenerSuscripcionRealtime()
  settings.desconectar()
  toast.add({ title: 'Desconectado de Supabase', color: 'gray', icon: 'i-heroicons-cloud' })
}

async function copiarSql() {
  try {
    await navigator.clipboard.writeText(sync.scriptSql)
    sqlCopiado.value = true
    toast.add({
      title: 'Script SQL copiado',
      description: 'Pégalo en el SQL Editor de tu consola de Supabase.',
      color: 'green',
      icon: 'i-heroicons-clipboard-document-check',
    })
    setTimeout(() => {
      sqlCopiado.value = false
    }, 2500)
  } catch {
    toast.add({
      title: 'No se pudo copiar automáticamente',
      description: 'Por favor selecciona el texto del código y cópialo manualmente.',
      color: 'yellow',
    })
  }
}

function vaciar() {
  accounts.vaciarTodo()
  modalVaciar.value = false
  toast.add({ title: 'Todos los datos fueron eliminados', color: 'gray', icon: 'i-heroicons-trash' })
}

function restaurarDemo() {
  accounts.restaurarDemo()
  toast.add({ title: 'Datos de ejemplo restaurados', color: 'amber', icon: 'i-heroicons-sparkles' })
}

const formAlertas = reactive({
  diasAlertaPagar: settings.diasAlertaVencimiento || 5,
  diasCreditoPagar: settings.diasCreditoPorDefecto || 15,
  diasAlertaCobrar: settings.diasAlertaCobro || 5,
  diasCreditoCobrar: settings.diasCreditoCliente || 15,
})

watch(
  () => [
    settings.diasAlertaVencimiento,
    settings.diasCreditoPorDefecto,
    settings.diasAlertaCobro,
    settings.diasCreditoCliente,
  ],
  ([alertaP, creditoP, alertaC, creditoC]) => {
    formAlertas.diasAlertaPagar = alertaP || 5
    formAlertas.diasCreditoPagar = creditoP || 15
    formAlertas.diasAlertaCobrar = alertaC || 5
    formAlertas.diasCreditoCobrar = creditoC || 15
  }
)

function guardarAlertas() {
  settings.guardarConfiguracionAlertas(
    formAlertas.diasAlertaPagar,
    formAlertas.diasCreditoPagar,
    formAlertas.diasAlertaCobrar,
    formAlertas.diasCreditoCobrar
  )
  toast.add({
    title: 'Preferencias de alertas guardadas',
    description: `Alertas de cobro: ${formAlertas.diasAlertaCobrar}d · Alertas de pago: ${formAlertas.diasAlertaPagar}d`,
    icon: 'i-heroicons-check-circle',
    color: 'blue',
  })
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div class="mb-6">
      <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Ajustes</p>
      <h1 class="font-display text-2xl sm:text-3xl mt-1" style="color: var(--ink-text)">Configuración del sistema</h1>
    </div>

    <!-- Sección Supabase y Sincronización en la Nube -->
    <UCard class="border border-[var(--ink-border)]">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-sm bg-emerald-500/10">
              <UIcon name="i-heroicons-cloud" class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 class="font-display text-lg" style="color: var(--ink-text)">Supabase · Sincronización en la Nube</h2>
              <p class="text-xs" style="color: var(--ink-text-muted)">Respaldo multi-dispositivo y base de datos compartida</p>
            </div>
          </div>
          <div>
            <span
              v-if="settings.realtimeActivo"
              class="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium"
              style="color: var(--status-good); background: color-mix(in srgb, var(--status-good) 15%, transparent)"
            >
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: var(--status-good)" />
                <span class="relative inline-flex rounded-full h-2 w-2" style="background: var(--status-good)" />
              </span>
              En tiempo real (Activo)
            </span>
            <span
              v-else-if="settings.connected && settings.tablesReady"
              class="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium"
              style="color: var(--status-good); background: color-mix(in srgb, var(--status-good) 15%, transparent)"
            >
              <span class="h-2 w-2 rounded-full" style="background: var(--status-good)" />
              Conectado y listo
            </span>
            <span
              v-else-if="settings.connected && !settings.tablesReady"
              class="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium"
              style="color: var(--status-warning); background: color-mix(in srgb, var(--status-warning) 15%, transparent)"
            >
              <span class="h-2 w-2 rounded-full" style="background: var(--status-warning)" />
              Faltan tablas SQL
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium"
              style="color: var(--ink-text-muted); background: var(--ink-surface-sunken)"
            >
              <span class="h-2 w-2 rounded-full" style="background: var(--ink-text-muted)" />
              No conectado
            </span>
          </div>
        </div>
      </template>

      <p class="text-xs sm:text-sm mb-3" style="color: var(--ink-text-secondary)">
        Conecta tu proyecto de <strong>Supabase</strong> para que todas las cuentas, facturas y pagos se sincronicen como una base de datos única y compartida.
        Cualquier cambio se transmite a los demás dispositivos en tiempo real y sin necesidad de recargar.
      </p>

      <div class="rounded-sm p-3 mb-4 text-xs sm:text-sm border flex items-start gap-2.5 bg-[var(--ink-surface-sunken)] border-[var(--ink-border)]">
        <UIcon name="i-heroicons-device-phone-mobile" class="h-5 w-5 shrink-0 mt-0.5" style="color: var(--cobrar)" />
        <div class="space-y-1">
          <p class="font-medium" style="color: var(--ink-text)">Para conectar todos los teléfonos automáticamente</p>
          <p style="color: var(--ink-text-muted)">
            Puedes agregar las variables <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> en la configuración de <strong>Netlify</strong> (Site configuration &gt; Environment variables). Así cualquier persona que abra el enlace desde su teléfono quedará conectada de inmediato a la misma base de datos sin tener que escribir las claves.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <UFormGroup label="URL del proyecto Supabase">
            <UInput
              v-model="settings.url"
              placeholder="https://xyzcompany.supabase.co"
              icon="i-heroicons-link"
              @blur="settings.persist()"
            />
          </UFormGroup>
          <UFormGroup label="Anon Public Key">
            <UInput
              v-model="settings.anonKey"
              type="password"
              placeholder="eyJhbGciOi..."
              icon="i-heroicons-key"
              @blur="settings.persist()"
            />
          </UFormGroup>
        </div>

        <!-- Banner de advertencia si está conectado pero no se ha ejecutado el SQL -->
        <div
          v-if="settings.connected && !settings.tablesReady"
          class="rounded-sm p-3 text-xs sm:text-sm border"
          style="background: color-mix(in srgb, var(--status-warning) 10%, transparent); border-color: var(--status-warning)"
        >
          <div class="flex items-start gap-2.5">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 shrink-0 mt-0.5" style="color: var(--status-warning)" />
            <div class="space-y-1">
              <p class="font-medium" style="color: var(--ink-text)">Las tablas aún no han sido creadas en tu proyecto Supabase</p>
              <p style="color: var(--ink-text-secondary)">
                Para habilitar la sincronización, copia nuestro script SQL e ingrésalo en el <strong>SQL Editor</strong> de Supabase.
              </p>
              <div class="pt-1">
                <UButton size="xs" color="yellow" variant="soft" icon="i-heroicons-code-bracket" @click="modalSql = true">
                  Ver script SQL y copiar
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <p v-if="settings.lastError && !settings.connected" class="text-xs sm:text-sm font-medium" style="color: var(--status-critical)">
          {{ settings.lastError }}
        </p>

        <!-- Toggle de Auto-Sincronización -->
        <div class="flex items-center justify-between rounded-sm p-3 border border-[var(--ink-border)] bg-[var(--ink-surface-sunken)]">
          <div>
            <p class="text-sm font-medium" style="color: var(--ink-text)">Sincronización automática en segundo plano</p>
            <p class="text-xs" style="color: var(--ink-text-muted)">
              Guarda en Supabase cada vez que crees, edites o elimines facturas y cobros.
            </p>
          </div>
          <UToggle v-model="settings.autoSync" color="green" @update:model-value="settings.persist()" />
        </div>

        <!-- Botones de Acción -->
        <div class="flex flex-wrap items-center gap-2 pt-2">
          <UButton
            color="amber"
            :loading="probando"
            icon="i-heroicons-bolt"
            @click="probar"
          >
            Probar conexión
          </UButton>

          <UButton
            v-if="settings.connected && settings.tablesReady"
            color="green"
            :loading="sincronizando"
            icon="i-heroicons-arrow-path"
            @click="sincronizarAhora"
          >
            Sincronizar ahora
          </UButton>

          <UButton
            v-if="settings.connected && settings.tablesReady && !settings.realtimeActivo"
            color="emerald"
            variant="soft"
            icon="i-heroicons-bolt"
            @click="conectarRealtime"
          >
            Activar tiempo real
          </UButton>

          <UButton
            v-if="settings.connected && settings.tablesReady"
            color="gray"
            variant="outline"
            :loading="subiendo"
            icon="i-heroicons-cloud-arrow-up"
            @click="subirNube"
          >
            Subir a la nube
          </UButton>

          <UButton
            v-if="settings.connected && settings.tablesReady"
            color="gray"
            variant="outline"
            :loading="descargando"
            icon="i-heroicons-cloud-arrow-down"
            @click="modalDescargar = true"
          >
            Descargar de la nube
          </UButton>

          <UButton
            color="gray"
            variant="soft"
            icon="i-heroicons-code-bracket"
            @click="modalSql = true"
          >
            Script SQL
          </UButton>

          <UButton
            v-if="settings.url && settings.anonKey"
            color="sky"
            variant="soft"
            icon="i-heroicons-device-phone-mobile"
            @click="abrirModalVincular"
          >
            Vincular teléfono (QR)
          </UButton>

          <UButton
            v-if="settings.connected"
            color="gray"
            variant="ghost"
            class="text-xs ml-auto"
            @click="desconectar"
          >
            Desconectar
          </UButton>
        </div>

        <!-- Metadatos de sincronización -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs" style="color: var(--ink-text-muted)">
          <span v-if="settings.lastCheckedAt">
            Verificación: {{ new Date(settings.lastCheckedAt).toLocaleString('es-VE') }}
          </span>
          <span v-if="settings.lastSyncAt" class="font-medium" style="color: var(--ink-text-secondary)">
            Última sincronización: {{ new Date(settings.lastSyncAt).toLocaleString('es-VE') }}
          </span>
        </div>
      </div>
    </UCard>

    <!-- Sección Alertas y Recordatorios de Vencimiento -->
    <UCard class="border border-[var(--ink-border)]">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-sm bg-amber-500/10">
            <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" style="color: var(--cobrar)" />
          </div>
          <div>
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Alertas y recordatorios de vencimiento</h2>
            <p class="text-xs" style="color: var(--ink-text-muted)">Avisos preventivos para cobros a clientes y pagos a proveedores</p>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Subsección: Cuentas por Cobrar (Clientes) -->
        <div class="space-y-3 pb-4 border-b border-[var(--ink-border)]">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" style="background: var(--cobrar)" />
            <h3 class="font-semibold text-sm" style="color: var(--ink-text)">Cuentas por Cobrar (Clientes)</h3>
          </div>
          <p class="text-xs" style="color: var(--ink-text-secondary)">
            Define con cuántos días antes del vencimiento se activará el recordatorio para contactar al cliente por WhatsApp.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormGroup label="Días de anticipación para recordatorio de cobro">
              <UInput v-model.number="formAlertas.diasAlertaCobrar" type="number" min="1" max="60" placeholder="5" />
            </UFormGroup>
            <UFormGroup label="Plazo de crédito concedido por defecto (días)">
              <UInput v-model.number="formAlertas.diasCreditoCobrar" type="number" min="0" max="180" placeholder="15" />
            </UFormGroup>
          </div>
        </div>

        <!-- Subsección: Cuentas por Pagar (Proveedores) -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" style="background: var(--pagar)" />
            <h3 class="font-semibold text-sm" style="color: var(--ink-text)">Cuentas por Pagar (Proveedores)</h3>
          </div>
          <p class="text-xs" style="color: var(--ink-text-secondary)">
            Define con cuántos días de anticipación alertar sobre facturas de compras para programar egresos a tiempo.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormGroup label="Días de anticipación para alerta de pago">
              <UInput v-model.number="formAlertas.diasAlertaPagar" type="number" min="1" max="60" placeholder="5" />
            </UFormGroup>
            <UFormGroup label="Plazo de crédito acordado por defecto (días)">
              <UInput v-model.number="formAlertas.diasCreditoPagar" type="number" min="0" max="180" placeholder="15" />
            </UFormGroup>
          </div>
        </div>

        <div class="pt-2">
          <UButton color="blue" icon="i-heroicons-check" @click="guardarAlertas">
            Guardar preferencias de alerta
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Datos Locales y Mantenimiento -->
    <UCard class="border border-[var(--ink-border)]">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-sm bg-gray-500/10">
            <UIcon name="i-heroicons-circle-stack" class="h-5 w-5" style="color: var(--ink-text-secondary)" />
          </div>
          <div>
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Datos locales del navegador</h2>
            <p class="text-xs" style="color: var(--ink-text-muted)">Almacenamiento offline y opciones de prueba</p>
          </div>
        </div>
      </template>
      <p class="text-xs sm:text-sm mb-4" style="color: var(--ink-text-secondary)">
        Tu cartera se guarda en este navegador. Puedes restaurar los datos de demostración para explorar el sistema o
        vaciar todo para comenzar desde cero e importar tus planillas de Excel.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton color="gray" variant="outline" icon="i-heroicons-sparkles" @click="restaurarDemo">Restaurar datos demo</UButton>
        <UButton color="red" variant="outline" icon="i-heroicons-trash" @click="modalVaciar = true">Vaciar todos los datos</UButton>
      </div>
    </UCard>

    <!-- Modal: Script SQL para Supabase -->
    <UModal v-model="modalSql" :ui="{ width: 'sm:max-w-3xl' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-code-bracket" class="h-5 w-5 text-emerald-600" />
              <h3 class="font-display text-lg" style="color: var(--ink-text)">Esquema SQL para Supabase</h3>
            </div>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" size="sm" @click="modalSql = false" />
          </div>
        </template>

        <div class="space-y-3">
          <p class="text-xs sm:text-sm" style="color: var(--ink-text-secondary)">
            Copia este código y ejecútalo en la consola de tu proyecto de Supabase:
            <span class="font-semibold text-emerald-600">SQL Editor &rarr; New Query &rarr; Pegar &rarr; Run</span>.
            Creará las tablas <code class="px-1 py-0.5 rounded bg-[var(--ink-surface-sunken)]">cuentas</code>,
            <code class="px-1 py-0.5 rounded bg-[var(--ink-surface-sunken)]">creditos</code> y
            <code class="px-1 py-0.5 rounded bg-[var(--ink-surface-sunken)]">abonos</code> con sus índices y políticas de seguridad (RLS).
          </p>

          <div class="relative">
            <pre class="bg-gray-900 text-gray-100 p-4 rounded-md text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">{{ sync.scriptSql }}</pre>
            <div class="absolute top-2 right-2">
              <UButton
                :color="sqlCopiado ? 'green' : 'gray'"
                size="xs"
                :icon="sqlCopiado ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                @click="copiarSql"
              >
                {{ sqlCopiado ? '¡Copiado!' : 'Copiar SQL' }}
              </UButton>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between items-center">
            <p class="text-xs" style="color: var(--ink-text-muted)">
              Archivo guardado también en el repositorio como <code>supabase/schema.sql</code>
            </p>
            <div class="flex gap-2">
              <UButton color="gray" variant="ghost" @click="modalSql = false">Cerrar</UButton>
              <UButton color="green" icon="i-heroicons-clipboard-document" @click="copiarSql">
                {{ sqlCopiado ? '¡Copiado!' : 'Copiar al portapapeles' }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Modal: Confirmar Descarga de Supabase -->
    <UModal v-model="modalDescargar">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">¿Restaurar datos desde Supabase?</h3>
        </template>
        <p class="text-sm" style="color: var(--ink-text-secondary)">
          Esta acción descargará todas las cuentas, facturas y pagos desde tu base de datos en Supabase y
          reemplazará los datos almacenados localmente en este navegador.
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalDescargar = false">Cancelar</UButton>
            <UButton color="amber" icon="i-heroicons-cloud-arrow-down" @click="descargarNube">
              Confirmar y descargar
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Modal: Vaciar todo -->
    <UModal v-model="modalVaciar">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">¿Vaciar todos los datos?</h3>
        </template>
        <p class="text-sm" style="color: var(--ink-text-secondary)">
          Se eliminarán todos los clientes, proveedores, facturas y cobros guardados en este navegador.
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalVaciar = false">Cancelar</UButton>
            <UButton color="red" @click="vaciar">Vaciar todo</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Modal: Vincular Teléfono Móvil con Código QR -->
    <UModal v-model="modalVincular" :ui="{ width: 'sm:max-w-md' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded bg-sky-500/10">
                <UIcon name="i-heroicons-device-phone-mobile" class="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 class="font-display text-base font-semibold" style="color: var(--ink-text)">Vincular Teléfono Móvil</h3>
                <p class="text-[11px]" style="color: var(--ink-text-muted)">Conexión instantánea sin escribir claves</p>
              </div>
            </div>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" size="xs" @click="modalVincular = false" />
          </div>
        </template>

        <div class="space-y-4 text-center">
          <p class="text-xs text-left" style="color: var(--ink-text-secondary)">
            Escanea este código con la cámara de tu teléfono para acceder a la misma base de datos en tiempo real:
          </p>

          <div v-if="qrDataUrl" class="inline-block p-3 rounded-lg bg-white shadow-sm border border-gray-200">
            <img :src="qrDataUrl" alt="Código QR de Vinculación Móvil" class="w-56 h-56 mx-auto block" />
          </div>

          <div class="text-left bg-[var(--ink-surface-sunken)] p-3 rounded text-xs space-y-1.5 border border-[var(--ink-border)]">
            <p class="font-medium flex items-center gap-1.5" style="color: var(--ink-text)">
              <UIcon name="i-heroicons-sparkles" class="h-3.5 w-3.5 text-amber-500" /> Pasos sencillos:
            </p>
            <ol class="list-decimal list-inside space-y-1" style="color: var(--ink-text-muted)">
              <li>Abre la app de <strong>Cámara</strong> en tu teléfono.</li>
              <li>Apunta hacia el código QR de arriba.</li>
              <li>Toca el enlace emergente para abrir Cartera Proaceros.</li>
              <li>¡Listo! Tu teléfono quedará conectado y sincronizado en vivo.</li>
            </ol>
          </div>

          <div class="pt-1">
            <UButton
              block
              color="gray"
              variant="outline"
              icon="i-heroicons-clipboard-document"
              @click="copiarEnlaceMovil"
            >
              {{ enlaceCopiado ? '¡Enlace copiado al portapapeles!' : 'Copiar enlace directo para WhatsApp' }}
            </UButton>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="gray" variant="ghost" size="sm" @click="modalVincular = false">Cerrar</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
