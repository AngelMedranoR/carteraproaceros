export type TipoCuenta = 'cliente' | 'proveedor'
export type EstadoCuenta = 'pagado' | 'pendiente' | 'vencido'

export interface Credito {
  id: string
  fecha: string // ISO date
  numeroFactura: string
  montoBolivares: number | null
  montoDivisas: number
}

export interface Abono {
  id: string
  fecha: string // ISO date
  montoBolivares: number | null
  montoDivisas: number
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
}
