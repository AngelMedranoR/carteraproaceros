<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  seriesA: number[]
  seriesB: number[]
  labelA: string
  labelB: string
  colorA: string
  colorB: string
  height?: number
}>()

const { colors, fontFamily, figuresFontFamily } = useChartTheme()
const { formatCompact } = useCurrency()

const config = computed(() => ({
  type: 'line' as const,
  data: {
    labels: props.labels,
    datasets: [
      {
        label: props.labelA,
        data: props.seriesA,
        borderColor: props.colorA,
        backgroundColor: props.colorA,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: props.labelB,
        data: props.seriesB,
        borderColor: props.colorB,
        backgroundColor: props.colorB,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.value.surface,
        titleColor: colors.value.text,
        bodyColor: colors.value.textSecondary,
        borderColor: colors.value.grid,
        borderWidth: 1,
        padding: 10,
        titleFont: { family: fontFamily },
        bodyFont: { family: figuresFontFamily },
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${formatCompact(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.value.textMuted, font: { family: fontFamily, size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: colors.value.grid },
        ticks: {
          color: colors.value.textMuted,
          font: { family: figuresFontFamily, size: 11 },
          callback: (v: any) => formatCompact(v),
        },
        border: { display: false },
      },
    },
  },
}))
</script>

<template>
  <div>
    <BaseChart :config="config as any" :height="height" />
    <div class="mt-3 flex items-center gap-5 text-xs" style="color: var(--ink-text-secondary)">
      <span class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full" :style="{ background: colorA }" />
        {{ labelA }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full" :style="{ background: colorB }" />
        {{ labelB }}
      </span>
    </div>
  </div>
</template>
