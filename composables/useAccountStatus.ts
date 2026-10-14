import type { Cuenta, EstadoCuenta } from '~/types'

const DIAS_VENCIMIENTO = 45

export function totalCreditos(cuenta: Cuenta) {
  return cuenta.creditos.reduce((sum, c) => sum + (c.montoDivisas || 0), 0)
}

export function totalAbonos(cuenta: Cuenta) {
  return cuenta.abonos.reduce((sum, a) => sum + (a.montoDivisas || 0), 0)
}

export function saldoPendiente(cuenta: Cuenta) {
  return totalCreditos(cuenta) - totalAbonos(cuenta)
}

export function fechaCreditoMasAntiguo(cuenta: Cuenta) {
  const fechas = cuenta.creditos
    .map((c) => new Date(c.fecha))
    .filter((d) => !Number.isNaN(d.getTime()))
  if (!fechas.length) return null
  return new Date(Math.min(...fechas.map((d) => d.getTime())))
}

export function useAccountStatus() {
  const getEstado = (cuenta: Cuenta): EstadoCuenta => {
    const saldo = saldoPendiente(cuenta)
    if (saldo <= 0.5) return 'pagado'

    const antiguo = fechaCreditoMasAntiguo(cuenta)
    if (!antiguo) return 'pendiente'

    const dias = (Date.now() - antiguo.getTime()) / (1000 * 60 * 60 * 24)
    return dias > DIAS_VENCIMIENTO ? 'vencido' : 'pendiente'
  }

  const estadoConfig: Record<EstadoCuenta, { label: string; color: string; icon: string }> = {
    pagado: { label: 'Al día', color: 'var(--status-good)', icon: 'i-heroicons-check-circle' },
    pendiente: { label: 'Pendiente', color: 'var(--status-warning)', icon: 'i-heroicons-clock' },
    vencido: { label: 'Vencido', color: 'var(--status-critical)', icon: 'i-heroicons-exclamation-triangle' },
  }

  return { getEstado, estadoConfig }
}
