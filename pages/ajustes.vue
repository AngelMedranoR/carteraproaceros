<script setup lang="ts">
const settings = useSettingsStore()
const accounts = useAccountsStore()
const toast = useToast()

onMounted(() => {
  settings.hydrate()
  accounts.hydrate()
})

const probando = ref(false)
async function probar() {
  probando.value = true
  const ok = await settings.probarConexion()
  probando.value = false
  toast.add({
    title: ok ? 'Conexión exitosa' : 'No se pudo conectar',
    description: ok ? 'Supabase respondió correctamente.' : settings.lastError,
    color: ok ? 'green' : 'red',
    icon: ok ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle',
  })
}

function desconectar() {
  settings.desconectar()
  toast.add({ title: 'Desconectado de Supabase', color: 'gray', icon: 'i-heroicons-cloud' })
}

const modalVaciar = ref(false)
function vaciar() {
  accounts.vaciarTodo()
  modalVaciar.value = false
  toast.add({ title: 'Todos los datos fueron eliminados', color: 'gray', icon: 'i-heroicons-trash' })
}

function restaurarDemo() {
  accounts.restaurarDemo()
  toast.add({ title: 'Datos de ejemplo restaurados', color: 'amber', icon: 'i-heroicons-sparkles' })
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--ink-text-muted)">Ajustes</p>
      <h1 class="font-display text-3xl mt-1" style="color: var(--ink-text)">Conexión y datos</h1>
    </div>

    <UCard class="mb-5">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <UIcon name="i-heroicons-cloud" class="h-5 w-5" style="color: var(--ink-text-secondary)" />
            <h2 class="font-display text-lg" style="color: var(--ink-text)">Supabase</h2>
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium"
            :style="{
              color: settings.connected ? 'var(--status-good)' : 'var(--ink-text-muted)',
              background: settings.connected ? 'var(--good-soft)' : 'var(--neutral-soft)',
            }"
          >
            <span class="h-1.5 w-1.5 rounded-full" :style="{ background: settings.connected ? 'var(--status-good)' : 'var(--ink-text-muted)' }" />
            {{ settings.connected ? 'Conectado' : 'No conectado' }}
          </span>
        </div>
      </template>

      <p class="text-sm mb-4" style="color: var(--ink-text-secondary)">
        Cartera 360 funciona por defecto guardando los datos en este navegador. Si prefieres respaldar y
        sincronizar tu cartera en la nube, conecta un proyecto de Supabase con sus credenciales públicas
        (URL y anon key).
      </p>

      <div class="space-y-4">
        <UFormGroup label="URL del proyecto">
          <UInput v-model="settings.url" placeholder="https://tuproyecto.supabase.co" />
        </UFormGroup>
        <UFormGroup label="Anon key">
          <UInput v-model="settings.anonKey" type="password" placeholder="eyJhbGciOi..." />
        </UFormGroup>
        <p v-if="settings.lastError" class="text-sm" style="color: var(--status-critical)">{{ settings.lastError }}</p>
        <div class="flex gap-2">
          <UButton color="amber" :loading="probando" icon="i-heroicons-bolt" @click="probar">Probar conexión</UButton>
          <UButton v-if="settings.connected" color="gray" variant="ghost" @click="desconectar">Desconectar</UButton>
        </div>
        <p v-if="settings.lastCheckedAt" class="text-xs" style="color: var(--ink-text-muted)">
          Última verificación: {{ new Date(settings.lastCheckedAt).toLocaleString('es-VE') }}
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-display text-lg" style="color: var(--ink-text)">Datos locales</h2>
      </template>
      <p class="text-sm mb-4" style="color: var(--ink-text-secondary)">
        Tu cartera se guarda automáticamente en este navegador. Puedes restaurar los datos de ejemplo o
        vaciar todo para empezar desde cero e importar tus propios archivos Excel.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton color="gray" variant="outline" icon="i-heroicons-sparkles" @click="restaurarDemo">Restaurar datos de ejemplo</UButton>
        <UButton color="red" variant="outline" icon="i-heroicons-trash" @click="modalVaciar = true">Vaciar todos los datos</UButton>
      </div>
    </UCard>

    <UModal v-model="modalVaciar">
      <UCard>
        <template #header>
          <h3 class="font-display text-lg" style="color: var(--ink-text)">¿Vaciar todos los datos?</h3>
        </template>
        <p class="text-sm" style="color: var(--ink-text-secondary)">
          Se eliminarán todos los clientes, proveedores, créditos y abonos guardados en este navegador.
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="modalVaciar = false">Cancelar</UButton>
            <UButton color="red" @click="vaciar">Vaciar todo</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
