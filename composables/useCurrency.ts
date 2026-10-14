export function useCurrency() {
  const formatDivisas = (value: number | null | undefined) => {
    const n = value ?? 0
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  }

  const formatBolivares = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—'
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + ' Bs.'
  }

  const formatCompact = (value: number | null | undefined) => {
    const n = value ?? 0
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  }

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  }

  return { formatDivisas, formatBolivares, formatCompact, formatDate }
}
