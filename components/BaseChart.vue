<script setup lang="ts">
import { Chart, type ChartConfiguration } from 'chart.js/auto'

const props = defineProps<{
  config: ChartConfiguration
  height?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function render() {
  if (!canvasRef.value) return
  chart?.destroy()
  chart = new Chart(canvasRef.value, props.config)
}

onMounted(render)
onBeforeUnmount(() => chart?.destroy())
watch(() => props.config, render, { deep: true })
</script>

<template>
  <div class="relative w-full min-w-0 max-w-full overflow-hidden" :style="{ height: `${height || 260}px` }">
    <canvas ref="canvasRef" class="w-full max-w-full" />
  </div>
</template>
