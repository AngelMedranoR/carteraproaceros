import { defineStore } from 'pinia'
import type { Cuenta, Credito, Abono, TipoCuenta } from '~/types'
import { crearDatosDemo } from '~/data/fixtures'

const STORAGE_KEY = 'cartera360.cuentas.v1'

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

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
    persist() {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cuentas))
    },
    restaurarDemo() {
      this.cuentas = crearDatosDemo()
      this.persist()
    },
    vaciarTodo() {
      this.cuentas = []
      this.persist()
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
        sync.eliminarCreditoRemoto(creditoId)
      } catch {}
    },
    eliminarAbono(cuentaId: string, abonoId: string) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.abonos = cuenta.abonos.filter((a) => a.id !== abonoId)
      this.persist()
      try {
        const sync = useSupabaseSync()
        sync.eliminarAbonoRemoto(abonoId)
      } catch {}
    },
    reemplazarCuentasDeTipo(tipo: TipoCuenta, cuentas: Cuenta[]) {
      this.cuentas = [...this.cuentas.filter((c) => c.tipo !== tipo), ...cuentas]
      this.persist()
    },
    reemplazarTodasLasCuentas(cuentas: Cuenta[]) {
      this.cuentas = cuentas
      this.persist()
    },
  },
})
