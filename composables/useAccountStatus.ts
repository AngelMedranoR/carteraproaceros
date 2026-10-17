import type { Cuenta, EstadoCuenta, Credito, EstadoFactura } from '~/types'

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
  let minFecha: string | null = null
  for (const c of cuenta.creditos) {
    if (!c.fecha) continue
    if (!minFecha || c.fecha < minFecha) {
      minFecha = c.fecha
    }
  }
  return minFecha ? parseLocalDate(minFecha) : null
}

export interface InfoEstadoFactura {
  estado: EstadoFactura
  label: string
  color: string
  icon: string
  diasRestantes: number | null
  fechaVencimiento: string | null
  pendienteMonto: number
}

export function calcularVencimientoCredito(credito: Credito): string | null {
  if (credito.fechaVencimiento) return credito.fechaVencimiento
  if (credito.diasCredito !== null && credito.diasCredito !== undefined && credito.fecha) {
    return addDaysToDate(credito.fecha, credito.diasCredito)
  }
  return null
}

export function getEstadosFacturasCuenta(cuenta: Cuenta, diasAlertaParam?: number): Map<string, InfoEstadoFactura> {
  const mapa = new Map<string, InfoEstadoFactura>()
  if (!cuenta.creditos || !cuenta.creditos.length) return mapa

  let diasAlerta = diasAlertaParam
  if (diasAlerta === undefined) {
    try {
      const settings = useSettingsStore()
      diasAlerta = cuenta.tipo === 'cliente'
        ? (settings.diasAlertaCobro ?? settings.diasAlertaVencimiento ?? 5)
        : (settings.diasAlertaVencimiento ?? 5)
    } catch {
      diasAlerta = 5
    }
  }

  // Ordenar créditos cronológicamente una sola vez
  const creditosOrdenados = [...cuenta.creditos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  let abonosRestantes = totalAbonos(cuenta)

  for (const c of creditosOrdenados) {
    let pendienteMonto = c.montoDivisas
    if (abonosRestantes >= c.montoDivisas) {
      abonosRestantes -= c.montoDivisas
      pendienteMonto = 0
    } else {
      pendienteMonto = Math.max(0, c.montoDivisas - abonosRestantes)
      abonosRestantes = 0
    }

    if (pendienteMonto <= 0.01) {
      mapa.set(c.id, {
        estado: 'pagada',
        label: 'Saldada',
        color: 'var(--ink-text-muted)',
        icon: 'i-heroicons-check-circle',
        diasRestantes: null,
        fechaVencimiento: c.fechaVencimiento || null,
        pendienteMonto: 0,
      })
      continue
    }

    const fechaVenc = calcularVencimientoCredito(c)
    if (!fechaVenc) {
      mapa.set(c.id, {
        estado: 'en_plazo',
        label: 'Pendiente',
        color: 'var(--status-warning)',
        icon: 'i-heroicons-clock',
        diasRestantes: null,
        fechaVencimiento: null,
        pendienteMonto,
      })
      continue
    }

    const dias = diffDaysFromToday(fechaVenc)
    if (dias === null) {
      mapa.set(c.id, {
        estado: 'en_plazo',
        label: 'Pendiente',
        color: 'var(--status-warning)',
        icon: 'i-heroicons-clock',
        diasRestantes: null,
        fechaVencimiento: fechaVenc,
        pendienteMonto,
      })
      continue
    }

    if (dias < 0) {
      const abs = Math.abs(dias)
      mapa.set(c.id, {
        estado: 'vencida',
        label: abs === 1 ? 'Vencida hace 1 día' : `Vencida hace ${abs} días`,
        color: 'var(--status-critical)',
        icon: 'i-heroicons-exclamation-triangle',
        diasRestantes: dias,
        fechaVencimiento: fechaVenc,
        pendienteMonto,
      })
    } else if (dias === 0) {
      mapa.set(c.id, {
        estado: 'por_vencer',
        label: 'Vence hoy',
        color: 'var(--status-critical)',
        icon: 'i-heroicons-clock',
        diasRestantes: 0,
        fechaVencimiento: fechaVenc,
        pendienteMonto,
      })
    } else if (dias <= diasAlerta) {
      mapa.set(c.id, {
        estado: 'por_vencer',
        label: dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`,
        color: 'var(--status-warning)',
        icon: 'i-heroicons-clock',
        diasRestantes: dias,
        fechaVencimiento: fechaVenc,
        pendienteMonto,
      })
    } else {
      mapa.set(c.id, {
        estado: 'en_plazo',
        label: `Vence en ${dias} días`,
        color: 'var(--status-good)',
        icon: 'i-heroicons-calendar',
        diasRestantes: dias,
        fechaVencimiento: fechaVenc,
        pendienteMonto,
      })
    }
  }

  return mapa
}

export function getEstadoFactura(credito: Credito, cuenta: Cuenta, diasAlertaParam?: number): InfoEstadoFactura {
  const mapa = getEstadosFacturasCuenta(cuenta, diasAlertaParam)
  const info = mapa.get(credito.id)
  if (info) return info

  return {
    estado: 'en_plazo',
    label: 'Pendiente',
    color: 'var(--status-warning)',
    icon: 'i-heroicons-clock',
    diasRestantes: null,
    fechaVencimiento: credito.fechaVencimiento || null,
    pendienteMonto: credito.montoDivisas || 0,
  }
}

export function obtenerAlertasProveedores(proveedores: Cuenta[], diasAlertaParam?: number) {
  let diasAlerta = diasAlertaParam
  if (diasAlerta === undefined) {
    try {
      const settings = useSettingsStore()
      diasAlerta = settings.diasAlertaVencimiento ?? 5
    } catch {
      diasAlerta = 5
    }
  }
  const alertas: {
    proveedor: Cuenta
    credito: Credito
    info: InfoEstadoFactura
  }[] = []

  for (const p of proveedores) {
    if (p.tipo !== 'proveedor' || !p.creditos.length) continue
    const mapa = getEstadosFacturasCuenta(p, diasAlerta)
    for (const c of p.creditos) {
      const info = mapa.get(c.id)
      if (info && (info.estado === 'vencida' || info.estado === 'por_vencer')) {
        alertas.push({ proveedor: p, credito: c, info })
      }
    }
  }

  return alertas.sort((a, b) => (a.info.diasRestantes ?? 999) - (b.info.diasRestantes ?? 999))
}

export function obtenerRecordatoriosClientes(clientes: Cuenta[], diasAlertaParam?: number) {
  let diasAlerta = diasAlertaParam
  if (diasAlerta === undefined) {
    try {
      const settings = useSettingsStore()
      diasAlerta = settings.diasAlertaCobro ?? settings.diasAlertaVencimiento ?? 5
    } catch {
      diasAlerta = 5
    }
  }
  const recordatorios: {
    cliente: Cuenta
    credito: Credito
    info: InfoEstadoFactura
  }[] = []

  for (const cl of clientes) {
    if (cl.tipo !== 'cliente' || !cl.creditos.length) continue
    const mapa = getEstadosFacturasCuenta(cl, diasAlerta)
    for (const c of cl.creditos) {
      const info = mapa.get(c.id)
      if (info && (info.estado === 'vencida' || info.estado === 'por_vencer')) {
        recordatorios.push({ cliente: cl, credito: c, info })
      }
    }
  }

  return recordatorios.sort((a, b) => (a.info.diasRestantes ?? 999) - (b.info.diasRestantes ?? 999))
}

export function generarMensajeCobro(cliente: Cuenta, credito: Credito, info?: InfoEstadoFactura): string {
  const monto = `$${(credito.montoDivisas || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
  const montoBs = credito.montoBolivares
    ? ` (${credito.montoBolivares.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.)`
    : ''
  const numFactura = credito.numeroFactura ? `N° ${credito.numeroFactura}` : ''
  const fechaVenc = info?.fechaVencimiento || credito.fechaVencimiento

  if (info?.estado === 'vencida') {
    return `Hola estimado/a ${cliente.nombre}, le escribimos cordialmente de cobranzas. Le recordamos que la factura ${numFactura} por un monto de ${monto}${montoBs} se encuentra vencida desde el ${fechaVenc || 'plazo acordado'}. Le agradecemos confirmar el pago a la brevedad posible. ¡Muchas gracias!`
  }

  return `Hola estimado/a ${cliente.nombre}, le saludamos cordialmente. Le recordamos amablemente que su factura ${numFactura} por un monto de ${monto}${montoBs} vence el ${fechaVenc || 'en los próximos días'}. Quedamos a su orden para coordinar el pago o ante cualquier consulta. ¡Feliz día!`
}

export function generarEnlaceWhatsApp(mensaje: string, telefono = ''): string {
  const encoded = encodeURIComponent(mensaje)
  if (telefono && telefono.trim()) {
    const numLimpio = telefono.replace(/\D/g, '')
    return `https://wa.me/${numLimpio}?text=${encoded}`
  }
  return `https://wa.me/?text=${encoded}`
}

export const estadoConfig: Record<EstadoCuenta, { label: string; color: string; icon: string }> = {
  pagado: { label: 'Al día', color: 'var(--status-good)', icon: 'i-heroicons-check-circle' },
  pendiente: { label: 'Pendiente', color: 'var(--status-warning)', icon: 'i-heroicons-clock' },
  vencido: { label: 'Vencido', color: 'var(--status-critical)', icon: 'i-heroicons-exclamation-triangle' },
}

export function useAccountStatus() {
  const settings = useSettingsStore()

  const getEstado = (cuenta: Cuenta): EstadoCuenta => {
    const saldo = saldoPendiente(cuenta)
    if (saldo <= 0.5) return 'pagado'

    const antiguo = fechaCreditoMasAntiguo(cuenta)
    if (!antiguo) return 'pendiente'

    const dias = (Date.now() - antiguo.getTime()) / (1000 * 60 * 60 * 24)
    return dias > DIAS_VENCIMIENTO ? 'vencido' : 'pendiente'
  }

  return {
    getEstado,
    getEstadosFacturasCuenta: (cuenta: Cuenta, dias?: number) =>
      getEstadosFacturasCuenta(
        cuenta,
        dias ?? (cuenta.tipo === 'cliente' ? settings.diasAlertaCobro : settings.diasAlertaVencimiento)
      ),
    getEstadoFactura: (credito: Credito, cuenta: Cuenta, dias?: number) =>
      getEstadoFactura(
        credito,
        cuenta,
        dias ?? (cuenta.tipo === 'cliente' ? settings.diasAlertaCobro : settings.diasAlertaVencimiento)
      ),
    obtenerAlertasProveedores: (proveedores: Cuenta[], dias?: number) =>
      obtenerAlertasProveedores(proveedores, dias ?? settings.diasAlertaVencimiento),
    obtenerRecordatoriosClientes: (clientes: Cuenta[], dias?: number) =>
      obtenerRecordatoriosClientes(clientes, dias ?? settings.diasAlertaCobro),
    generarMensajeCobro,
    generarEnlaceWhatsApp,
    estadoConfig,
  }
}
