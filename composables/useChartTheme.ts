export function useChartTheme() {
  const colorMode = useColorMode()

  function readVar(name: string) {
    if (typeof window === 'undefined') return '#000000'
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const colors = computed(() => {
    // depend on colorMode.value so charts re-render on theme toggle
    // eslint-disable-next-line no-unused-expressions
    colorMode.value
    return {
      text: readVar('--ink-text'),
      textSecondary: readVar('--ink-text-secondary'),
      textMuted: readVar('--ink-text-muted'),
      grid: readVar('--ink-border'),
      surface: readVar('--ink-surface'),
      cobrar: readVar('--cobrar'),
      pagar: readVar('--pagar'),
      good: readVar('--status-good'),
      warning: readVar('--status-warning'),
      critical: readVar('--status-critical'),
    }
  })

  const fontFamily = "'Public Sans', system-ui, -apple-system, sans-serif"
  const figuresFontFamily = "'IBM Plex Mono', monospace"

  return { colors, fontFamily, figuresFontFamily }
}
