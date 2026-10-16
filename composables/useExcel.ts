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

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const t = v.trim().replace(/ /g, '')
    if (!t) return null
    const n = Number(t.replace(/,/g, ''))
    return Number.isNaN(n) ? null : n
  }
  return null
}

function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t || t === ' ') return null
    const match = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmy) {
      const day = dmy[1].padStart(2, '0')
      const month = dmy[2].padStart(2, '0')
      const year = dmy[3]
      return `${year}-${month}-${day}`
    }
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().toLowerCase()
}

interface Columnas {
  headerRow: number
  fecha: number
  numeroFactura: number
  montoBolivares: number
  montoDivisas: number
  fechaAbono: number
  montoAbonoBolivares: number
  montoAbonoDivisas: number
  comentario: number
}

function detectarColumnas(rows: unknown[][]): Columnas | null {
  const maxScan = Math.min(rows.length, 20)
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] || []
    let fecha = -1
    let numeroFactura = -1
    let montoBolivares = -1
    let montoDivisas = -1
    let fechaAbono = -1
    let montoAbonoBolivares = -1
    let montoAbonoDivisas = -1
    let comentario = -1

    row.forEach((cell, idx) => {
      const t = cellText(cell)
      if (!t) return
      if (t.includes('fecha de factura')) fecha = idx
      else if (t.includes('numero de factura') || t.includes('número de factura')) numeroFactura = idx
      else if (t.includes('monto de factura en bolivares')) montoBolivares = idx
      else if (t.includes('monto de factura en divisas')) montoDivisas = idx
      else if (t.includes('fecha de abono')) fechaAbono = idx
      else if (t.includes('monto de abono en bolivares')) montoAbonoBolivares = idx
      else if (t.includes('monto de abono en divisas')) montoAbonoDivisas = idx
      else if (t.includes('comentario')) comentario = idx
    })

    if (fecha >= 0 && montoDivisas >= 0) {
      return {
        headerRow: r,
        fecha,
        numeroFactura,
        montoBolivares,
        montoDivisas,
        fechaAbono,
        montoAbonoBolivares,
        montoAbonoDivisas,
        comentario,
      }
    }
  }
  return null
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
      const columnas = detectarColumnas(rows)
      if (!columnas) {
        hojasOmitidas.push(`${nombreHoja} (formato no reconocido)`)
        return
      }

      const creditos: Credito[] = []
      const abonos: Abono[] = []

      for (let r = columnas.headerRow + 1; r < rows.length; r++) {
        const row = rows[r] || []

        const fecha = toIsoDate(row[columnas.fecha])
        const numeroFactura = columnas.numeroFactura >= 0 ? row[columnas.numeroFactura] : null
        const montoBolivares = columnas.montoBolivares >= 0 ? toNumber(row[columnas.montoBolivares]) : null
        const montoDivisas = toNumber(row[columnas.montoDivisas])

        if (fecha || numeroFactura || montoDivisas !== null) {
          if (fecha || montoDivisas !== null) {
            creditos.push({
              id: newId('cr'),
              fecha: fecha || '',
              numeroFactura: numeroFactura !== null && numeroFactura !== undefined ? String(numeroFactura) : '',
              montoBolivares,
              montoDivisas: montoDivisas || 0,
            })
          }
        }

        const fechaAbono = columnas.fechaAbono >= 0 ? toIsoDate(row[columnas.fechaAbono]) : null
        const montoAbonoBolivares =
          columnas.montoAbonoBolivares >= 0 ? toNumber(row[columnas.montoAbonoBolivares]) : null
        const montoAbonoDivisas = columnas.montoAbonoDivisas >= 0 ? toNumber(row[columnas.montoAbonoDivisas]) : null
        const comentario = columnas.comentario >= 0 ? row[columnas.comentario] : null

        if (fechaAbono || montoAbonoDivisas !== null || comentario) {
          if (montoAbonoDivisas !== null && montoAbonoDivisas !== 0) {
            abonos.push({
              id: newId('ab'),
              fecha: fechaAbono || '',
              montoBolivares: montoAbonoBolivares,
              montoDivisas: montoAbonoDivisas || 0,
              comentario: comentario ? String(comentario).trim() : '',
            })
          }
        }
      }

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
