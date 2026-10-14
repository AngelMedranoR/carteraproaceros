<script setup lang="ts">
const props = defineProps<{
  items: { label: string; value: number }[]
  color: string
  height?: number
}>()

const { colors, fontFamily, figuresFontFamily } = useChartTheme()
const { formatCompact } = useCurrency()

const config = computed(() => ({
  type: 'bar' as const,
  data: {
    labels: props.items.map((i) => i.label),
    datasets: [
      {
        data: props.items.map((i) => i.value),
        backgroundColor: props.color,
        borderRadius: 3,
        borderSkipped: false,
        barThickness: 16,
      },
    ],
  },
  options: {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
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
          label: (ctx: any) => formatCompact(ctx.raw),
        },
      },
    },
    scales: {
      x: {
        grid: { color: colors.value.grid },
        ticks: {
          color: colors.value.textMuted,
          font: { family: figuresFontFamily, size: 11 },
          callback: (v: any) => formatCompact(v),
        },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { color: colors.value.textSecondary, font: { family: fontFamily, size: 12 } },
        border: { display: false },
      },
    },
  },
}))
</script>

<template>
  <BaseChart :config="config as any" :height="height" />
</template>
