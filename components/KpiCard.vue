<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon: string
    tone?: 'cobrar' | 'pagar' | 'good' | 'critical' | 'neutral'
    hint?: string
  }>(),
  { tone: 'neutral', hint: '' }
)

const accentVar = computed(() => {
  const map: Record<string, string> = {
    cobrar: '--cobrar',
    pagar: '--pagar',
    good: '--status-good',
    critical: '--status-critical',
    neutral: '--ink-text',
  }
  return `var(${map[props.tone]})`
})

const softVar = computed(() => {
  const map: Record<string, string> = {
    cobrar: '--cobrar-soft',
    pagar: '--pagar-soft',
    good: '--good-soft',
    critical: '--critical-soft',
    neutral: '--neutral-soft',
  }
  return `var(${map[props.tone]})`
})
</script>

<template>
  <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
    <div class="flex items-start justify-between gap-2.5">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide truncate" style="color: var(--ink-text-muted)">
          {{ label }}
        </p>
        <p class="mt-2 font-figures text-lg sm:text-2xl font-semibold leading-tight break-words" :style="{ color: accentVar }">
          {{ value }}
        </p>
        <p v-if="hint" class="mt-1.5 text-xs truncate" style="color: var(--ink-text-secondary)">{{ hint }}</p>
      </div>
      <div class="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-sm" :style="{ background: softVar }">
        <UIcon :name="icon" class="h-4 w-4 sm:h-4.5 sm:w-4.5" :style="{ color: accentVar }" />
      </div>
    </div>
  </UCard>
</template>
