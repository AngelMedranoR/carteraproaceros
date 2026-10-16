export type TipoCuenta = 'cliente' | 'proveedor'
export type EstadoCuenta = 'pagado' | 'pendiente' | 'vencido'
export type EstadoFactura = 'pagada' | 'en_plazo' | 'por_vencer' | 'vencida'

export interface Credito {
  id: string
  fecha: string // ISO date YYYY-MM-DD
  numeroFactura: string
  montoBolivares: number | null
  montoDivisas: number
  tasaCambio?: number | null
  fechaVencimiento?: string | null // ISO date YYYY-MM-DD
  diasCredito?: number | null
  descripcion?: string
}

export interface Abono {
  id: string
  fecha: string // ISO date YYYY-MM-DD
  montoBolivares: number | null
  montoDivisas: number
  tasaCambio?: number | null
  comentario: string
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  creditos: Credito[]
  abonos: Abono[]
}

export interface SupabaseSettings {
  url: string
  anonKey: string
  connected: boolean
  lastCheckedAt: string | null
  lastSyncAt?: string | null
  autoSync?: boolean
  tablesReady?: boolean
  lastError?: string
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncResult {
  ok: boolean
  mensaje: string
  cuentasCount?: number
  creditosCount?: number
  abonosCount?: number
  error?: string
}

export interface AlertSettings {
  diasAlertaVencimiento: number
  diasCreditoPorDefecto: number
}

export interface EstadisticasImportacion {
  cuentasTotal: number
  cuentasNuevas: number
  cuentasExistentes: number
  creditosTotal: number
  creditosNuevos: number
  creditosExistentesOmitidos: number
  abonosTotal: number
  abonosNuevos: number
  abonosExistentesOmitidos: number
}

export interface ResumenCuentaImportacion {
  nombre: string
  esNueva: boolean
  nuevasFacturas: number
  facturasOmitidas: number
  nuevosAbonos: number
  abonosOmitidos: number
}

export interface ConsolidacionResultado {
  cuentasConsolidadas: Cuenta[]
  estadisticas: EstadisticasImportacion
  hojasOmitidas: string[]
  cuentasAfectadas: ResumenCuentaImportacion[]
  cuentasNuevasParaSubir: Cuenta[]
  creditosNuevosParaSubir: Array<{ cuentaId: string; credito: Credito }>
  abonosNuevosParaSubir: Array<{ cuentaId: string; abono: Abono }>
}

