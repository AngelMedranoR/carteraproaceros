export function getTodayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    return new Date(year, month, day)
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return dateStr
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dateStr
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
  d.setDate(d.getDate() + Number(days || 0))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function diffDaysFromToday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = parseLocalDate(dateStr)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

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
    return (
      new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) + ' Bs.'
    )
  }

  const formatTasa = (value: number | null | undefined) => {
    if (value === null || value === undefined || value <= 0) return '—'
    return (
      new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(value) + ' Bs/$'
    )
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
    const d = parseLocalDate(value)
    if (!d) return '—'
    return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  }

  return {
    formatDivisas,
    formatBolivares,
    formatTasa,
    formatCompact,
    formatDate,
    getTodayDateString,
    addDaysToDate,
    diffDaysFromToday,
  }
}

