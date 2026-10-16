<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()

const nav = [
  { to: '/', label: 'Panel', icon: 'i-heroicons-squares-2x2' },
  { to: '/cobrar', label: 'Por Cobrar', icon: 'i-heroicons-arrow-down-left' },
  { to: '/pagar', label: 'Por Pagar', icon: 'i-heroicons-arrow-up-right' },
  { to: '/ajustes', label: 'Ajustes', icon: 'i-heroicons-cog-6-tooth' },
]

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const accountsStore = useAccountsStore()
const settingsStore = useSettingsStore()
const sync = useSupabaseSync()
const toast = useToast()

onMounted(async () => {
  accountsStore.hydrate()
  settingsStore.hydrate()
  const vinculado = sync.procesarCredencialesDesdeUrl()
  await sync.inicializarSincronizacion()
  if (vinculado) {
    toast.add({
      title: '¡Dispositivo vinculado con éxito!',
      description: 'Conectado a la base de datos de Cartera 360 en tiempo real.',
      color: 'green',
      icon: 'i-heroicons-bolt',
    })
  }
})
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Desktop sidebar -->
    <aside
      class="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 border-r"
      style="border-color: var(--ink-border)"
    >
      <div class="px-6 py-7">
        <NuxtLink to="/" class="flex items-baseline gap-2">
          <span class="font-display text-2xl tracking-tight" style="color: var(--ink-text)">Cartera</span>
          <span class="font-display text-2xl italic" style="color: var(--cobrar)">360</span>
        </NuxtLink>
        <p class="mt-1 text-xs uppercase tracking-[0.18em]" style="color: var(--ink-text-muted)">
          Cobranzas &amp; pagos
        </p>
      </div>

      <nav class="flex-1 px-3 space-y-1">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors"
          :style="
            isActive(item.to)
              ? 'background: var(--cobrar-soft); color: var(--ink-text)'
              : 'color: var(--ink-text-secondary)'
          "
        >
          <UIcon :name="item.icon" class="h-4.5 w-4.5" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="px-3 pb-6 space-y-2">
        <NuxtLink
          to="/ajustes"
          class="flex items-center justify-between rounded-sm px-3 py-2 text-xs border transition-colors hover:border-[var(--ink-border-focus)]"
          :style="
            settingsStore.realtimeActivo
              ? 'background: color-mix(in srgb, var(--status-good) 12%, transparent); border-color: color-mix(in srgb, var(--status-good) 40%, transparent); color: var(--ink-text)'
              : settingsStore.connected && settingsStore.tablesReady
              ? 'background: color-mix(in srgb, var(--status-good) 8%, transparent); border-color: color-mix(in srgb, var(--status-good) 30%, transparent); color: var(--ink-text)'
              : 'background: var(--ink-surface-sunken); border-color: var(--ink-border); color: var(--ink-text-secondary)'
          "
        >
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              :name="
                settingsStore.syncStatus === 'syncing'
                  ? 'i-heroicons-arrow-path'
                  : settingsStore.realtimeActivo
                  ? 'i-heroicons-bolt'
                  : settingsStore.connected
                  ? 'i-heroicons-cloud'
                  : 'i-heroicons-circle-stack'
              "
              class="h-4 w-4 shrink-0"
              :class="{ 'animate-spin': settingsStore.syncStatus === 'syncing' }"
              :style="{
                color:
                  settingsStore.realtimeActivo || (settingsStore.connected && settingsStore.tablesReady)
                    ? 'var(--status-good)'
                    : 'var(--ink-text-muted)',
              }"
            />
            <span class="truncate">
              {{
                settingsStore.syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : settingsStore.realtimeActivo
                  ? 'En tiempo real'
                  : settingsStore.connected && settingsStore.tablesReady
                  ? 'Nube activa'
                  : settingsStore.connected
                  ? 'Faltan tablas'
                  : 'Modo local'
              }}
            </span>
          </div>
          <span class="relative flex h-2 w-2 shrink-0">
            <span
              v-if="settingsStore.realtimeActivo"
              class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style="background: var(--status-good)"
            />
            <span
              class="relative inline-flex rounded-full h-2 w-2"
              :style="{
                background:
                  settingsStore.realtimeActivo || (settingsStore.connected && settingsStore.tablesReady)
                    ? 'var(--status-good)'
                    : settingsStore.connected
                    ? 'var(--status-warning)'
                    : 'var(--ink-text-muted)',
              }"
            />
          </span>
        </NuxtLink>

        <button
          class="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium"
          style="color: var(--ink-text-secondary)"
          @click="toggleColorMode"
        >
          <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="h-4.5 w-4.5" />
          {{ colorMode.value === 'dark' ? 'Modo claro' : 'Modo oscuro' }}
        </button>
      </div>
    </aside>

    <div class="flex-1 min-w-0 max-w-full pb-24 lg:pb-0">
      <!-- Mobile top bar -->
      <header
        class="lg:hidden flex items-center justify-between px-4 py-3.5 border-b sticky top-0 z-30 backdrop-blur"
        style="border-color: var(--ink-border); background: var(--ink-bg)"
      >
        <NuxtLink to="/" class="flex items-baseline gap-1.5">
          <span class="font-display text-lg" style="color: var(--ink-text)">Cartera</span>
          <span class="font-display text-lg italic" style="color: var(--cobrar)">360</span>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/ajustes"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs border"
            :style="
              settingsStore.realtimeActivo || (settingsStore.connected && settingsStore.tablesReady)
                ? 'background: color-mix(in srgb, var(--status-good) 10%, transparent); border-color: var(--status-good); color: var(--status-good)'
                : 'background: var(--ink-surface-sunken); border-color: var(--ink-border); color: var(--ink-text-muted)'
            "
          >
            <span v-if="settingsStore.realtimeActivo" class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: var(--status-good)" />
              <span class="relative inline-flex rounded-full h-2 w-2" style="background: var(--status-good)" />
            </span>
            <UIcon
              v-else
              :name="settingsStore.syncStatus === 'syncing' ? 'i-heroicons-arrow-path' : 'i-heroicons-cloud'"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': settingsStore.syncStatus === 'syncing' }"
            />
            <span class="hidden sm:inline">
              {{
                settingsStore.syncStatus === 'syncing'
                  ? 'Sincronizando'
                  : settingsStore.realtimeActivo
                  ? 'En vivo'
                  : settingsStore.connected && settingsStore.tablesReady
                  ? 'Nube'
                  : 'Local'
              }}
            </span>
          </NuxtLink>
          <button aria-label="Cambiar tema" style="color: var(--ink-text-secondary)" @click="toggleColorMode">
            <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="h-5 w-5" />
          </button>
        </div>
      </header>

      <main class="px-3.5 sm:px-6 lg:px-10 py-5 sm:py-6 lg:py-8 max-w-[1400px] w-full min-w-0">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav
      class="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t"
      style="border-color: var(--ink-border); background: var(--ink-surface)"
    >
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
        :style="isActive(item.to) ? 'color: var(--cobrar)' : 'color: var(--ink-text-muted)'"
      >
        <UIcon :name="item.icon" class="h-5 w-5" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
