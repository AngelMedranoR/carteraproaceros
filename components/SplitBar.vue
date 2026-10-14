<script setup lang="ts">
const props = defineProps<{
  cobrar: number
  pagar: number
}>()

const { formatDivisas } = useCurrency()

const total = computed(() => Math.max(props.cobrar + props.pagar, 0.01))
const pctCobrar = computed(() => (props.cobrar / total.value) * 100)
const pctPagar = computed(() => (props.pagar / total.value) * 100)
</script>

<template>
  <div>
    <div class="flex h-3 w-full overflow-hidden rounded-full" style="background: var(--neutral-soft)">
      <div class="h-full transition-all" :style="{ width: `${pctCobrar}%`, background: 'var(--cobrar)' }" />
      <div class="h-full transition-all" :style="{ width: `${pctPagar}%`, background: 'var(--pagar)' }" />
    </div>
    <div class="mt-4 flex items-center justify-between text-sm">
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" style="background: var(--cobrar)" />
        <span style="color: var(--ink-text-secondary)">Por cobrar</span>
        <span class="font-figures font-semibold" style="color: var(--ink-text)">{{ formatDivisas(cobrar) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" style="background: var(--pagar)" />
        <span style="color: var(--ink-text-secondary)">Por pagar</span>
        <span class="font-figures font-semibold" style="color: var(--ink-text)">{{ formatDivisas(pagar) }}</span>
      </div>
    </div>
  </div>
</template>
