import { defineStore } from 'pinia'
import type { Cuenta, Credito, Abono, TipoCuenta } from '~/types'
import { crearDatosDemo } from '~/data/fixtures'

const STORAGE_KEY = 'cartera360.cuentas.v1'

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useAccountsStore = defineStore('accounts', {
  state: () => ({
    cuentas: [] as Cuenta[],
    hydrated: false,
  }),
  getters: {
    clientes(state): Cuenta[] {
      return state.cuentas.filter((c) => c.tipo === 'cliente')
    },
    proveedores(state): Cuenta[] {
      return state.cuentas.filter((c) => c.tipo === 'proveedor')
    },
  },
  actions: {
    hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      if (typeof window === 'undefined') return

      window.addEventListener('beforeunload', () => {
        this.persistImmediate()
      })

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          this.cuentas = JSON.parse(raw)
          return
        }
      } catch {
        // ignore corrupt storage, fall back to demo data
      }
      this.cuentas = crearDatosDemo()
    },
    persist(immediate = false) {
      if (typeof window === 'undefined') return
      if (immediate) {
        if (persistTimer) {
          clearTimeout(persistTimer)
          persistTimer = null
        }
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cuentas))
        } catch (e) {
          console.warn('Error al guardar en localStorage:', e)
        }
        return
      }

      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cuentas))
        } catch (e) {
          console.warn('Error al guardar en localStorage:', e)
        }
        persistTimer = null
      }, 250)
    },
    persistImmediate() {
      this.persist(true)
    },
    restaurarDemo() {
      this.cuentas = crearDatosDemo()
      this.persistImmediate()
    },
    vaciarTodo() {
      this.cuentas = []
      this.persistImmediate()
    },
    crearCuenta(nombre: string, tipo: TipoCuenta) {
      const cuenta: Cuenta = { id: newId(tipo === 'cliente' ? 'cli' : 'prov'), nombre, tipo, creditos: [], abonos: [] }
      this.cuentas.push(cuenta)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.sincronizarCuentaEnSegundoPlano(cuenta)
      } catch {}
      return cuenta
    },
    obtenerOCrearCuenta(nombre: string, tipo: TipoCuenta) {
      const existente = this.cuentas.find(
        (c) => c.tipo === tipo && c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
      )
      if (existente) return existente
      return this.crearCuenta(nombre, tipo)
    },
    eliminarCuenta(cuentaId: string) {
      this.cuentas = this.cuentas.filter((c) => c.id !== cuentaId)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.eliminarCuentaEnSegundoPlano(cuentaId)
      } catch {}
    },
    agregarCredito(cuentaId: string, credito: Omit<Credito, 'id'>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      const nuevoCredito = { ...credito, id: newId('cr') }
      cuenta.creditos.push(nuevoCredito)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.sincronizarCreditoEnSegundoPlano(cuentaId, nuevoCredito)
      } catch {}
    },
    actualizarCredito(cuentaId: string, creditoId: string, datos: Partial<Omit<Credito, 'id'>>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      const idx = cuenta.creditos.findIndex((c) => c.id === creditoId)
      if (idx !== -1) {
        cuenta.creditos[idx] = { ...cuenta.creditos[idx], ...datos }
        this.persist()
        try {
          const sync = useSupabaseSync()
          sync.sincronizarCreditoEnSegundoPlano(cuentaId, cuenta.creditos[idx])
        } catch {}
      }
    },
    agregarAbono(cuentaId: string, abonoData: Omit<Abono, 'id'>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      const nuevoAbono = { ...abonoData, id: newId('ab') }
      cuenta.abonos.push(nuevoAbono)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.sincronizarAbonoEnSegundoPlano(cuentaId, nuevoAbono)
      } catch {}
    },
    actualizarAbono(cuentaId: string, abonoId: string, datos: Partial<Omit<Abono, 'id'>>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      const idx = cuenta.abonos.findIndex((a) => a.id === abonoId)
      if (idx !== -1) {
        cuenta.abonos[idx] = { ...cuenta.abonos[idx], ...datos }
        this.persist()
        try {
          const sync = useSupabaseSync()
          sync.sincronizarAbonoEnSegundoPlano(cuentaId, cuenta.abonos[idx])
        } catch {}
      }
    },
    eliminarCredito(cuentaId: string, creditoId: string) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.creditos = cuenta.creditos.filter((c) => c.id !== creditoId)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.eliminarCreditoEnSegundoPlano(creditoId)
      } catch {}
    },
    eliminarAbono(cuentaId: string, abonoId: string) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.abonos = cuenta.abonos.filter((a) => a.id !== abonoId)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.eliminarAbonoEnSegundoPlano(abonoId)
      } catch {}
    },
    reemplazarCuentasDeTipo(tipo: TipoCuenta, cuentas: Cuenta[]) {
      this.cuentas = [...this.cuentas.filter((c) => c.tipo !== tipo), ...cuentas]
      this.persistImmediate()
    },
    aplicarImportacionConsolidada(cuentasConsolidadas: Cuenta[]) {
      this.cuentas = cuentasConsolidadas
      this.persistImmediate()
    },
    reemplazarTodasLasCuentas(cuentas: Cuenta[]) {
      this.cuentas = cuentas
      this.persistImmediate()
    },
    manejarEventoRealtimeCuentas(payload: { eventType: string; new: any; old: any }) {
      const { eventType, new: newRow, old: oldRow } = payload
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRow?.id) return
        const idx = this.cuentas.findIndex((c) => c.id === newRow.id)
        if (idx !== -1) {
          this.cuentas[idx].nombre = newRow.nombre
          this.cuentas[idx].tipo = newRow.tipo
        } else {
          this.cuentas.push({
            id: newRow.id,
            nombre: newRow.nombre,
            tipo: newRow.tipo,
            creditos: [],
            abonos: [],
          })
        }
        this.persist()
      } else if (eventType === 'DELETE') {
        if (!oldRow?.id) return
        this.cuentas = this.cuentas.filter((c) => c.id !== oldRow.id)
        this.persist()
      }
    },
    manejarEventoRealtimeCreditos(payload: { eventType: string; new: any; old: any }) {
      const { eventType, new: newRow, old: oldRow } = payload
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRow?.id || !newRow?.cuenta_id) return
        const cuenta = this.cuentas.find((c) => c.id === newRow.cuenta_id)
        if (!cuenta) {
          try {
            const sync = useSupabaseSync()
            sync.solicitarReconciliacionDebounced()
          } catch {}
          return
        }
        const credito: Credito = {
          id: newRow.id,
          fecha: newRow.fecha,
          numeroFactura: newRow.numero_factura || '',
          montoBolivares:
            newRow.monto_bolivares !== null && newRow.monto_bolivares !== undefined
              ? Number(newRow.monto_bolivares)
              : null,
          montoDivisas: Number(newRow.monto_divisas) || 0,
          tasaCambio:
            newRow.tasa_cambio !== null && newRow.tasa_cambio !== undefined
              ? Number(newRow.tasa_cambio)
              : null,
          fechaVencimiento: newRow.fecha_vencimiento || null,
          diasCredito:
            newRow.dias_credito !== null && newRow.dias_credito !== undefined
              ? Number(newRow.dias_credito)
              : null,
          descripcion: newRow.descripcion || '',
        }
        const idx = cuenta.creditos.findIndex((cr) => cr.id === credito.id)
        if (idx !== -1) {
          cuenta.creditos[idx] = credito
        } else {
          cuenta.creditos.push(credito)
        }
        this.persist()
      } else if (eventType === 'DELETE') {
        if (!oldRow?.id) return
        for (const c of this.cuentas) {
          const prevLen = c.creditos.length
          c.creditos = c.creditos.filter((cr) => cr.id !== oldRow.id)
          if (c.creditos.length !== prevLen) {
            this.persist()
            break
          }
        }
      }
    },
    manejarEventoRealtimeAbonos(payload: { eventType: string; new: any; old: any }) {
      const { eventType, new: newRow, old: oldRow } = payload
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRow?.id || !newRow?.cuenta_id) return
        const cuenta = this.cuentas.find((c) => c.id === newRow.cuenta_id)
        if (!cuenta) {
          try {
            const sync = useSupabaseSync()
            sync.solicitarReconciliacionDebounced()
          } catch {}
          return
        }
        const abono: Abono = {
          id: newRow.id,
          fecha: newRow.fecha,
          montoBolivares:
            newRow.monto_bolivares !== null && newRow.monto_bolivares !== undefined
              ? Number(newRow.monto_bolivares)
              : null,
          montoDivisas: Number(newRow.monto_divisas) || 0,
          tasaCambio:
            newRow.tasa_cambio !== null && newRow.tasa_cambio !== undefined
              ? Number(newRow.tasa_cambio)
              : null,
          comentario: newRow.comentario || '',
        }
        const idx = cuenta.abonos.findIndex((ab) => ab.id === abono.id)
        if (idx !== -1) {
          cuenta.abonos[idx] = abono
        } else {
          cuenta.abonos.push(abono)
        }
        this.persist()
      } else if (eventType === 'DELETE') {
        if (!oldRow?.id) return
        for (const c of this.cuentas) {
          const prevLen = c.abonos.length
          c.abonos = c.abonos.filter((ab) => ab.id !== oldRow.id)
          if (c.abonos.length !== prevLen) {
            this.persist()
            break
          }
        }
      }
    },
  },
})
