<script setup lang="ts">
import type { EstadoCuenta } from '~/types'

const props = defineProps<{ estado: EstadoCuenta }>()
const { estadoConfig } = useAccountStatus()
const config = computed(() => estadoConfig[props.estado])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium"
    :style="{ color: config.color, background: `color-mix(in srgb, ${config.color} 16%, transparent)` }"
  >
    <UIcon :name="config.icon" class="h-3.5 w-3.5" />
    {{ config.label }}
  </span>
</template>
