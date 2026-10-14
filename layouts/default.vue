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
onMounted(() => {
  accountsStore.hydrate()
  settingsStore.hydrate()
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

      <div class="px-3 pb-6">
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

    <div class="flex-1 min-w-0 pb-20 lg:pb-0">
      <!-- Mobile top bar -->
      <header
        class="lg:hidden flex items-center justify-between px-4 py-4 border-b sticky top-0 z-30 backdrop-blur"
        style="border-color: var(--ink-border); background: var(--ink-bg)"
      >
        <NuxtLink to="/" class="flex items-baseline gap-1.5">
          <span class="font-display text-lg" style="color: var(--ink-text)">Cartera</span>
          <span class="font-display text-lg italic" style="color: var(--cobrar)">360</span>
        </NuxtLink>
        <button aria-label="Cambiar tema" style="color: var(--ink-text-secondary)" @click="toggleColorMode">
          <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="h-5 w-5" />
        </button>
      </header>

      <main class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1400px]">
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
