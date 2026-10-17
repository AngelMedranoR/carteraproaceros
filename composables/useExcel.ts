import * as XLSX from 'xlsx'
import type {
  Cuenta,
  Credito,
  Abono,
  TipoCuenta,
  ConsolidacionResultado,
  ResumenCuentaImportacion,
  EstadisticasImportacion,
} from '~/types'

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizarNombre(nombre: string): string {
  return (nombre || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function esCreditoDuplicado(nuevo: Credito, existentes: Credito[]): Credito | undefined {
  const numNuevo = (nuevo.numeroFactura || '').trim().toLowerCase()
  if (numNuevo) {
    const match = existentes.find((c) => (c.numeroFactura || '').trim().toLowerCase() === numNuevo)
    if (match) return match
  }
  return existentes.find((c) => {
    const numExistente = (c.numeroFactura || '').trim().toLowerCase()
    const mismaFecha = c.fecha === nuevo.fecha
    const mismoMonto = Math.abs((c.montoDivisas || 0) - (nuevo.montoDivisas || 0)) < 0.001
    if (mismaFecha && mismoMonto) {
      if (!numNuevo && !numExistente) return true
      if (numNuevo && numExistente && numNuevo === numExistente) return true
    }
    return false
  })
}

export function esAbonoDuplicado(nuevo: Abono, existentes: Abono[]): Abono | undefined {
  const comentarioNuevo = (nuevo.comentario || '').trim().toLowerCase()
  return existentes.find((a) => {
    const mismaFecha = a.fecha === nuevo.fecha
    const mismoMonto = Math.abs((a.montoDivisas || 0) - (nuevo.montoDivisas || 0)) < 0.001
    if (!mismaFecha || !mismoMonto) return false
    const comentarioExistente = (a.comentario || '').trim().toLowerCase()
    if (comentarioNuevo && comentarioExistente) {
      return comentarioNuevo === comentarioExistente
    }
    return true
  })
}

export function consolidarImportacion(
  cuentasLeidas: Cuenta[],
  cuentasActuales: Cuenta[],
  tipo: TipoCuenta,
  hojasOmitidas: string[] = []
): ConsolidacionResultado {
  // Cuentas del otro tipo permanecen intactas
  const cuentasOtroTipo = cuentasActuales.filter((c) => c.tipo !== tipo)
  // Clonar cuentas del tipo actual para trabajar sobre ellas
  const cuentasTipoActual: Cuenta[] = cuentasActuales
    .filter((c) => c.tipo === tipo)
    .map((c) => ({
      ...c,
      creditos: [...c.creditos.map((cr) => ({ ...cr }))],
      abonos: [...c.abonos.map((ab) => ({ ...ab }))],
    }))

  const estadisticas: EstadisticasImportacion = {
    cuentasTotal: cuentasLeidas.length,
    cuentasNuevas: 0,
    cuentasExistentes: 0,
    creditosTotal: 0,
    creditosNuevos: 0,
    creditosExistentesOmitidos: 0,
    abonosTotal: 0,
    abonosNuevos: 0,
    abonosExistentesOmitidos: 0,
  }

  const cuentasAfectadas: ResumenCuentaImportacion[] = []
  const cuentasNuevasParaSubir: Cuenta[] = []
  const creditosNuevosParaSubir: Array<{ cuentaId: string; credito: Credito }> = []
  const abonosNuevosParaSubir: Array<{ cuentaId: string; abono: Abono }> = []

  for (const leida of cuentasLeidas) {
    const nombreNorm = normalizarNombre(leida.nombre)
    estadisticas.creditosTotal += leida.creditos.length
    estadisticas.abonosTotal += leida.abonos.length

    const existente = cuentasTipoActual.find(
      (c) => normalizarNombre(c.nombre) === nombreNorm
    )

    if (existente) {
      estadisticas.cuentasExistentes++
      let nuevasFacturas = 0
      let facturasOmitidas = 0
      let nuevosAbonos = 0
      let abonosOmitidos = 0

      // Fusionar créditos
      for (const cr of leida.creditos) {
        const dup = esCreditoDuplicado(cr, existente.creditos)
        if (dup) {
          facturasOmitidas++
          estadisticas.creditosExistentesOmitidos++
          // Si el registro entrante tiene datos complementarios, enriquecer el existente
          if (dup.montoBolivares === null && cr.montoBolivares !== null) {
            dup.montoBolivares = cr.montoBolivares
          }
          if (!dup.fechaVencimiento && cr.fechaVencimiento) {
            dup.fechaVencimiento = cr.fechaVencimiento
          }
          if (!dup.descripcion && cr.descripcion) {
            dup.descripcion = cr.descripcion
          }
        } else {
          nuevasFacturas++
          estadisticas.creditosNuevos++
          const nuevoCr: Credito = {
            ...cr,
            id: cr.id && !cr.id.startsWith('temp') ? cr.id : newId('cr'),
          }
          existente.creditos.push(nuevoCr)
          creditosNuevosParaSubir.push({ cuentaId: existente.id, credito: nuevoCr })
        }
      }

      // Fusionar abonos
      for (const ab of leida.abonos) {
        const dup = esAbonoDuplicado(ab, existente.abonos)
        if (dup) {
          abonosOmitidos++
          estadisticas.abonosExistentesOmitidos++
          if (dup.montoBolivares === null && ab.montoBolivares !== null) {
            dup.montoBolivares = ab.montoBolivares
          }
          if (!dup.comentario && ab.comentario) {
            dup.comentario = ab.comentario
          }
        } else {
          nuevosAbonos++
          estadisticas.abonosNuevos++
          const nuevoAb: Abono = {
            ...ab,
            id: ab.id && !ab.id.startsWith('temp') ? ab.id : newId('ab'),
          }
          existente.abonos.push(nuevoAb)
          abonosNuevosParaSubir.push({ cuentaId: existente.id, abono: nuevoAb })
        }
      }

      cuentasAfectadas.push({
        nombre: existente.nombre,
        esNueva: false,
        nuevasFacturas,
        facturasOmitidas,
        nuevosAbonos,
        abonosOmitidos,
      })
    } else {
      // Cuenta completamente nueva
      estadisticas.cuentasNuevas++
      estadisticas.creditosNuevos += leida.creditos.length
      estadisticas.abonosNuevos += leida.abonos.length

      const nuevaCuentaId = leida.id || newId(tipo === 'cliente' ? 'cli' : 'prov')
      const nuevaCuenta: Cuenta = {
        id: nuevaCuentaId,
        nombre: leida.nombre.trim(),
        tipo,
        creditos: leida.creditos.map((cr) => ({
          ...cr,
          id: cr.id || newId('cr'),
        })),
        abonos: leida.abonos.map((ab) => ({
          ...ab,
          id: ab.id || newId('ab'),
        })),
      }

      cuentasTipoActual.push(nuevaCuenta)
      cuentasNuevasParaSubir.push(nuevaCuenta)

      for (const cr of nuevaCuenta.creditos) {
        creditosNuevosParaSubir.push({ cuentaId: nuevaCuenta.id, credito: cr })
      }
      for (const ab of nuevaCuenta.abonos) {
        abonosNuevosParaSubir.push({ cuentaId: nuevaCuenta.id, abono: ab })
      }

      cuentasAfectadas.push({
        nombre: nuevaCuenta.nombre,
        esNueva: true,
        nuevasFacturas: nuevaCuenta.creditos.length,
        facturasOmitidas: 0,
        nuevosAbonos: nuevaCuenta.abonos.length,
        abonosOmitidos: 0,
      })
    }
  }

  const cuentasConsolidadas = [...cuentasOtroTipo, ...cuentasTipoActual]

  return {
    cuentasConsolidadas,
    estadisticas,
    hojasOmitidas,
    cuentasAfectadas,
    cuentasNuevasParaSubir,
    creditosNuevosParaSubir,
    abonosNuevosParaSubir,
  }
}

function cleanText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().toLowerCase()
}

function normHeader(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.°#\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function esCampoFecha(t: string): boolean {
  return (
    t.includes('fecha') ||
    t.includes('fec') ||
    t === 'dia' ||
    t.startsWith('f ') ||
    t.endsWith(' f') ||
    t === 'f' ||
    t.includes('emision')
  )
}

function esCampoNumero(t: string): boolean {
  return (
    t.includes('numero') ||
    t.includes('nro') ||
    t.includes('no') ||
    t.includes('control') ||
    t.includes('doc') ||
    t.startsWith('n ') ||
    t === 'n' ||
    t === 'factura' ||
    t === 'facturas'
  )
}

function esEncabezadoAbono(t: string): boolean {
  return (
    t.includes('abono') ||
    t.includes('pago') ||
    t.includes('cobro') ||
    t.includes('haber')
  )
}

function esEncabezadoFactura(t: string): boolean {
  return (
    t.includes('factura') ||
    t.includes('credito') ||
    t.includes('debe') ||
    t.includes('cargo') ||
    t.includes('emision')
  )
}

function esFilaTotal(row: unknown[]): boolean {
  for (let c = 0; c < Math.min(row.length, 6); c++) {
    const t = normHeader(row[c])
    if (!t) continue
    if (
      t.startsWith('total') ||
      t.startsWith('subtotal') ||
      t.startsWith('saldo') ||
      t.startsWith('balance') ||
      t.startsWith('resumen') ||
      t.startsWith('diferencia') ||
      t.startsWith('restante') ||
      t.startsWith('pendiente') ||
      t === 'totales'
    ) {
      return true
    }
  }
  return false
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const t = v.trim().replace(/ /g, '')
    if (!t) return null
    const sinMoneda = t.replace(/[$€bsUSD\s]/gi, '')
    let n = NaN
    if (sinMoneda.includes('.') && sinMoneda.includes(',')) {
      if (sinMoneda.indexOf('.') < sinMoneda.indexOf(',')) {
        n = Number(sinMoneda.replace(/\./g, '').replace(',', '.'))
      } else {
        n = Number(sinMoneda.replace(/,/g, ''))
      }
    } else if (sinMoneda.includes(',')) {
      const partes = sinMoneda.split(',')
      if (partes[1] && partes[1].length === 2) {
        n = Number(sinMoneda.replace(',', '.'))
      } else {
        n = Number(sinMoneda.replace(/,/g, ''))
      }
    } else {
      n = Number(sinMoneda)
    }
    return Number.isNaN(n) ? null : n
  }
  return null
}

function sanitizeYear(y: number): number {
  if (y >= 1990 && y <= 2099) return y
  const yStr = String(y)
  if (yStr.includes('2026') || yStr.includes('26')) return 2026
  if (yStr.length === 5 && yStr.startsWith('2')) return 2026
  if (y >= 20000 && y <= 29999) return 2026
  if (y >= 2100 && y <= 2999) return 2026
  return 2026
}

export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined) return null
  let y: number, m: number, d: number

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    y = sanitizeYear(v.getFullYear())
    m = v.getMonth() + 1
    d = v.getDate()
  } else if (typeof v === 'number' && v > 20000 && v < 65000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const millis = excelEpoch.getTime() + Math.round(v * 86400 * 1000)
    const dt = new Date(millis)
    if (Number.isNaN(dt.getTime())) return null
    y = sanitizeYear(dt.getUTCFullYear())
    m = dt.getUTCMonth() + 1
    d = dt.getUTCDate()
  } else if (typeof v === 'string') {
    const t = v.trim()
    if (!t || t === ' ') return null
    const isoMatch = t.match(/^(\d{4,5})[-\/](\d{1,2})[-\/](\d{1,2})/)
    const dmyMatch = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4,5})/)
    if (isoMatch) {
      y = sanitizeYear(parseInt(isoMatch[1], 10))
      m = parseInt(isoMatch[2], 10)
      d = parseInt(isoMatch[3], 10)
    } else if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10)
      m = parseInt(dmyMatch[2], 10)
      y = sanitizeYear(parseInt(dmyMatch[3], 10))
    } else {
      const dt = new Date(t)
      if (Number.isNaN(dt.getTime())) return null
      y = sanitizeYear(dt.getFullYear())
      m = dt.getMonth() + 1
      d = dt.getDate()
    }
  } else {
    return null
  }

  if (m > 12 && d <= 12 && m <= 31) {
    const temp = m
    m = d
    d = temp
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

interface MovimientosHoja {
  creditos: Credito[]
  abonos: Abono[]
}

function parseHojaMovimientos(rows: unknown[][]): MovimientosHoja | null {
  const maxScan = Math.min(rows.length, 25)
  let headerRow = -1
  let abonosStartCol = -1

  // 1. Detectar si hay fila de secciones (ej. Row 3: "CREDITOS" en col 0..3 y "ABONOS" en col 4..7)
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] || []
    let hasCreditos = false
    let abonoCol = -1
    let hasColumnKeywords = false

    row.forEach((cell, idx) => {
      const t = normHeader(cell)
      if (esCampoFecha(t) || t.includes('monto') || esCampoNumero(t) || t === 'bs' || t === 'usd') {
        hasColumnKeywords = true
      }
      if (t === 'credito' || t === 'creditos' || t === 'facturas' || t === 'factura' || t === 'cuentas por cobrar' || t === 'cuentas por pagar') {
        hasCreditos = true
      }
      if (t === 'abono' || t === 'abonos' || t === 'pagos' || t === 'pago' || t === 'cobros' || t === 'cobro') {
        if (abonoCol === -1 || idx < abonoCol) abonoCol = idx
      }
    })

    if (!hasColumnKeywords && hasCreditos && abonoCol > 0) {
      abonosStartCol = abonoCol
      headerRow = r + 1
      break
    }
  }

  // 2. Escanear filas para mapear columnas
  let mapping = {
    fechaCr: -1,
    numeroFactura: -1,
    montoCrBolivares: -1,
    montoCrDivisas: -1,
    fechaAb: -1,
    montoAbBolivares: -1,
    montoAbDivisas: -1,
    comentarioAb: -1,
    tipo: -1,
  }

  const startScan = headerRow >= 0 ? headerRow : 0
  const scanLimit = headerRow >= 0 ? Math.min(rows.length, headerRow + 2) : maxScan

  for (let r = startScan; r < scanLimit; r++) {
    const row = rows[r] || []
    let fCr = -1
    let nFact = -1
    let mCrBs = -1
    let mCrDiv = -1
    let fAb = -1
    let mAbBs = -1
    let mAbDiv = -1
    let comAb = -1
    let tipoCol = -1

    row.forEach((cell, idx) => {
      const t = normHeader(cell)
      if (!t) return

      const isAbonoSection = abonosStartCol > 0 && idx >= abonosStartCol

      // Tipo de transacción
      if (t === 'tipo' || t === 'tipo movimiento' || t === 'tipo transaccion' || t === 'tipo de movimiento') {
        tipoCol = idx
        return
      }

      // Encabezados explícitos de ABONOS
      if (esEncabezadoAbono(t) || isAbonoSection) {
        if (esCampoFecha(t)) {
          fAb = idx
        } else if (t.includes('bolivar') || t.includes('bs')) {
          mAbBs = idx
        } else if (
          t.includes('divisa') ||
          t.includes('usd') ||
          t.includes('$') ||
          t.includes('monto') ||
          t === 'abono' ||
          t === 'abonos' ||
          t === 'pago' ||
          t === 'pagos' ||
          t === 'cobro' ||
          t === 'cobros' ||
          t === 'haber'
        ) {
          mAbDiv = idx
        } else if (
          t.includes('coment') ||
          t.includes('obser') ||
          t.includes('detall') ||
          t.includes('descrip') ||
          t.includes('concep') ||
          t.includes('banco') ||
          t.includes('ref')
        ) {
          comAb = idx
        }
        return
      }

      // Encabezados explícitos de FACTURAS / CRÉDITOS
      if (esEncabezadoFactura(t)) {
        if (esCampoFecha(t)) {
          fCr = idx
        } else if (esCampoNumero(t)) {
          nFact = idx
        } else if (t.includes('bolivar') || t.includes('bs')) {
          mCrBs = idx
        } else if (
          t.includes('divisa') ||
          t.includes('usd') ||
          t.includes('$') ||
          t.includes('monto') ||
          t.includes('importe') ||
          t.includes('debe')
        ) {
          mCrDiv = idx
        }
        return
      }

      // Encabezados genéricos
      if (esCampoFecha(t)) {
        if (fCr === -1) fCr = idx
        else if (fAb === -1) fAb = idx
      } else if (esCampoNumero(t)) {
        if (nFact === -1) nFact = idx
      } else if (t.includes('bolivar') || t === 'bs') {
        if (mCrBs === -1) mCrBs = idx
        else if (mAbBs === -1) mAbBs = idx
      } else if (
        t.includes('divisa') ||
        t.includes('usd') ||
        t.includes('$') ||
        t.includes('monto') ||
        t.includes('importe')
      ) {
        if (mCrDiv === -1) mCrDiv = idx
        else if (mAbDiv === -1) mAbDiv = idx
      } else if (
        t.includes('coment') ||
        t.includes('obser') ||
        t.includes('detall') ||
        t.includes('descrip') ||
        t.includes('concep') ||
        t.includes('ref')
      ) {
        comAb = idx
      }
    })

    if ((fCr >= 0 || fAb >= 0) && (mCrDiv >= 0 || mAbDiv >= 0)) {
      headerRow = r
      mapping = {
        fechaCr: fCr,
        numeroFactura: nFact,
        montoCrBolivares: mCrBs,
        montoCrDivisas: mCrDiv,
        fechaAb: fAb,
        montoAbBolivares: mAbBs,
        montoAbDivisas: mAbDiv,
        comentarioAb: comAb,
        tipo: tipoCol,
      }
      break
    }
  }

  if (headerRow === -1) {
    return null
  }

  const creditos: Credito[] = []
  const abonos: Abono[] = []

  let modoVerticalAbonos = false
  let mappingAbonosVertical: {
    fechaAb: number
    montoAbDivisas: number
    montoAbBolivares: number
    comentarioAb: number
  } | null = null

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || []
    if (row.length === 0 || row.every((c) => c === null || c === undefined || c === '')) {
      continue
    }

    // Verificar si es un separador de sección vertical hacia ABONOS
    if (!modoVerticalAbonos && mapping.montoAbDivisas === -1) {
      let tieneTituloAbonos = false
      row.forEach((cell) => {
        const t = normHeader(cell)
        if (t === 'abonos' || t === 'pagos' || t === 'cobros' || t === 'relacion de abonos' || t === 'relacion de pagos') {
          tieneTituloAbonos = true
        }
      })
      if (tieneTituloAbonos) {
        modoVerticalAbonos = true
        continue
      }
    }

    // Si entramos en modo vertical de abonos, buscar encabezado de abonos si aún no lo tenemos
    if (modoVerticalAbonos && !mappingAbonosVertical) {
      let vfAb = -1
      let vmAbDiv = -1
      let vmAbBs = -1
      let vcomAb = -1
      row.forEach((cell, idx) => {
        const t = normHeader(cell)
        if (esCampoFecha(t)) vfAb = idx
        else if (t.includes('bolivar') || t.includes('bs')) vmAbBs = idx
        else if (t.includes('divisa') || t.includes('usd') || t.includes('$') || t.includes('monto') || t.includes('abono') || t.includes('pago')) vmAbDiv = idx
        else if (t.includes('coment') || t.includes('obser') || t.includes('detall') || t.includes('descrip') || t.includes('ref')) vcomAb = idx
      })
      if (vfAb >= 0 || vmAbDiv >= 0) {
        mappingAbonosVertical = {
          fechaAb: vfAb >= 0 ? vfAb : mapping.fechaCr,
          montoAbDivisas: vmAbDiv >= 0 ? vmAbDiv : mapping.montoCrDivisas,
          montoAbBolivares: vmAbBs >= 0 ? vmAbBs : mapping.montoCrBolivares,
          comentarioAb: vcomAb >= 0 ? vcomAb : (mapping.numeroFactura >= 0 ? mapping.numeroFactura : -1),
        }
        continue
      }
    }

    // Ignorar filas de totales / subtotales / saldos
    if (esFilaTotal(row)) {
      continue
    }

    // Si estamos en la sección vertical de abonos
    if (modoVerticalAbonos) {
      const vMap = mappingAbonosVertical || {
        fechaAb: mapping.fechaCr,
        montoAbDivisas: mapping.montoCrDivisas,
        montoAbBolivares: mapping.montoCrBolivares,
        comentarioAb: mapping.numeroFactura,
      }
      const fecha = vMap.fechaAb >= 0 ? toIsoDate(row[vMap.fechaAb]) : null
      const montoDiv = vMap.montoAbDivisas >= 0 ? toNumber(row[vMap.montoAbDivisas]) : null
      const montoBs = vMap.montoAbBolivares >= 0 ? toNumber(row[vMap.montoAbBolivares]) : null
      const comentario = vMap.comentarioAb >= 0 ? cleanText(row[vMap.comentarioAb]) : ''

      if (montoDiv !== null && montoDiv !== 0) {
        abonos.push({
          id: newId('ab'),
          fecha: fecha || '',
          montoBolivares: montoBs,
          montoDivisas: Math.abs(montoDiv),
          comentario,
        })
      }
      continue
    }

    // Modo normal: Side-by-side, Ledger, o Fila con Tipo/Monto firmado
    const fechaCr = mapping.fechaCr >= 0 ? toIsoDate(row[mapping.fechaCr]) : null
    const numFact = mapping.numeroFactura >= 0 ? cleanText(row[mapping.numeroFactura]) : ''
    const montoCrBs = mapping.montoCrBolivares >= 0 ? toNumber(row[mapping.montoCrBolivares]) : null
    const montoCrDiv = mapping.montoCrDivisas >= 0 ? toNumber(row[mapping.montoCrDivisas]) : null

    const fechaAb = (mapping.fechaAb >= 0 ? toIsoDate(row[mapping.fechaAb]) : null) || fechaCr || null
    const montoAbBs = mapping.montoAbBolivares >= 0 ? toNumber(row[mapping.montoAbBolivares]) : null
    const montoAbDiv = mapping.montoAbDivisas >= 0 ? toNumber(row[mapping.montoAbDivisas]) : null
    const comAb = mapping.comentarioAb >= 0 ? cleanText(row[mapping.comentarioAb]) : ''

    // Caso A: Columna "Tipo" explícita
    if (mapping.tipo >= 0) {
      const tipoVal = normHeader(row[mapping.tipo])
      const esAbono = esEncabezadoAbono(tipoVal)
      const monto = montoCrDiv !== null ? montoCrDiv : montoAbDiv
      if (monto !== null && monto !== 0) {
        if (esAbono) {
          abonos.push({
            id: newId('ab'),
            fecha: fechaAb || fechaCr || '',
            montoBolivares: montoAbBs || montoCrBs,
            montoDivisas: Math.abs(monto),
            comentario: comAb || numFact,
          })
        } else {
          creditos.push({
            id: newId('cr'),
            fecha: fechaCr || '',
            numeroFactura: numFact,
            montoBolivares: montoCrBs,
            montoDivisas: Math.abs(monto),
          })
        }
      }
      continue
    }

    // Caso B: Columna única de monto con signo negativo para abonos
    if (mapping.montoAbDivisas === -1 && montoCrDiv !== null && montoCrDiv < 0) {
      abonos.push({
        id: newId('ab'),
        fecha: fechaCr || '',
        montoBolivares: montoCrBs !== null ? Math.abs(montoCrBs) : null,
        montoDivisas: Math.abs(montoCrDiv),
        comentario: comAb || numFact,
      })
      continue
    }

    // Caso C: Crédito (debe tener un monto positivo válido o factura con monto != 0)
    if (montoCrDiv !== null && montoCrDiv > 0) {
      creditos.push({
        id: newId('cr'),
        fecha: fechaCr || '',
        numeroFactura: numFact,
        montoBolivares: montoCrBs,
        montoDivisas: montoCrDiv,
      })
    } else if (numFact && montoCrDiv !== null && montoCrDiv !== 0) {
      creditos.push({
        id: newId('cr'),
        fecha: fechaCr || '',
        numeroFactura: numFact,
        montoBolivares: montoCrBs,
        montoDivisas: montoCrDiv,
      })
    }

    // Caso D: Abono (debe tener un monto positivo válido)
    if (montoAbDiv !== null && montoAbDiv > 0) {
      abonos.push({
        id: newId('ab'),
        fecha: fechaAb || '',
        montoBolivares: montoAbBs,
        montoDivisas: montoAbDiv,
        comentario: comAb,
      })
    }
  }

  return { creditos, abonos }
}

function esHojaResumen(nombre: string) {
  return /^resumen/i.test(nombre.trim())
}

export interface ResultadoImportacion {
  cuentas: Cuenta[]
  hojasOmitidas: string[]
  hojasImportadas: number
}

export function useExcel() {
  async function parseWorkbook(file: File, tipo: TipoCuenta): Promise<ResultadoImportacion> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })

    const hojasOmitidas: string[] = []
    const cuentas: Cuenta[] = []

    const infoHojas = workbook.Workbook?.Sheets || []

    workbook.SheetNames.forEach((nombreHoja, idx) => {
      const oculta = infoHojas[idx]?.Hidden && infoHojas[idx].Hidden !== 0
      const nombre = nombreHoja.trim()

      if (oculta) {
        hojasOmitidas.push(`${nombreHoja} (oculta)`)
        return
      }
      if (esHojaResumen(nombre)) {
        hojasOmitidas.push(`${nombreHoja} (resumen)`)
        return
      }

      const ws = workbook.Sheets[nombreHoja]
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
      const movimientos = parseHojaMovimientos(rows)
      if (!movimientos) {
        hojasOmitidas.push(`${nombreHoja} (formato no reconocido)`)
        return
      }

      const { creditos, abonos } = movimientos

      if (creditos.length === 0 && abonos.length === 0) {
        hojasOmitidas.push(`${nombreHoja} (sin movimientos)`)
        return
      }

      cuentas.push({ id: newId(tipo === 'cliente' ? 'cli' : 'prov'), nombre, tipo, creditos, abonos })
    })

    return { cuentas, hojasOmitidas, hojasImportadas: cuentas.length }
  }

  function exportarCuentas(cuentas: Cuenta[], tipo: TipoCuenta) {
    const workbook = XLSX.utils.book_new()
    const etiqueta = tipo === 'cliente' ? 'CLIENTE' : 'PROVEEDOR'

    const resumenRows: (string | number)[][] = [[etiqueta, 'SALDO PENDIENTE (USD)', 'N° CRÉDITOS', 'N° ABONOS']]
    cuentas.forEach((cuenta) => {
      const totalCreditos = cuenta.creditos.reduce((s, c) => s + (c.montoDivisas || 0), 0)
      const totalAbonos = cuenta.abonos.reduce((s, a) => s + (a.montoDivisas || 0), 0)
      resumenRows.push([cuenta.nombre, Number((totalCreditos - totalAbonos).toFixed(2)), cuenta.creditos.length, cuenta.abonos.length])
    })
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenRows)
    XLSX.utils.book_append_sheet(workbook, resumenSheet, tipo === 'cliente' ? 'RESUMEN CREDITOS' : 'RESUMEN DEUDAS')

    cuentas.forEach((cuenta) => {
      const totalCreditos = cuenta.creditos.reduce((s, c) => s + (c.montoDivisas || 0), 0)
      const totalAbonos = cuenta.abonos.reduce((s, a) => s + (a.montoDivisas || 0), 0)

      const rows: (string | number | null)[][] = []
      rows.push([cuenta.nombre])
      rows.push([])
      rows.push(['Total Pendiente:', null, null, null, null, Number((totalCreditos - totalAbonos).toFixed(2))])
      rows.push([])
      rows.push([
        'CREDITOS', null, null, null,
        'ABONOS', null, null, null,
      ])
      rows.push([
        'Fecha de factura', 'Número de factura', 'Monto de factura en Bolivares', 'Monto de factura en Divisas',
        'Fecha de Abono', 'Monto de abono en bolivares', 'Monto de abono en divisas', 'comentario',
      ])

      const maxRows = Math.max(cuenta.creditos.length, cuenta.abonos.length)
      for (let i = 0; i < maxRows; i++) {
        const c = cuenta.creditos[i]
        const a = cuenta.abonos[i]
        rows.push([
          c?.fecha || null,
          c?.numeroFactura || null,
          c?.montoBolivares ?? null,
          c ? c.montoDivisas : null,
          a?.fecha || null,
          a?.montoBolivares ?? null,
          a ? a.montoDivisas : null,
          a?.comentario || null,
        ])
      }

      const sheet = XLSX.utils.aoa_to_sheet(rows)
      const nombreHoja = cuenta.nombre.substring(0, 31) || 'Cuenta'
      XLSX.utils.book_append_sheet(workbook, sheet, nombreHoja)
    })

    const fecha = getTodayDateString()
    const nombreArchivo = tipo === 'cliente' ? `cuentas-por-cobrar-${fecha}.xlsx` : `cuentas-por-pagar-${fecha}.xlsx`
    XLSX.writeFile(workbook, nombreArchivo)
  }

  return {
    parseWorkbook,
    exportarCuentas,
    consolidarImportacion,
    normalizarNombre,
    esCreditoDuplicado,
    esAbonoDuplicado,
  }
}
