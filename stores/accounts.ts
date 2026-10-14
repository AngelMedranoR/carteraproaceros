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
    },
    agregarCredito(cuentaId: string, credito: Omit<Credito, 'id'>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.creditos.push({ ...credito, id: newId('cr') })
      this.persist()
    },
    agregarAbono(cuentaId: string, abonoData: Omit<Abono, 'id'>) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.abonos.push({ ...abonoData, id: newId('ab') })
      this.persist()
    },
    eliminarCredito(cuentaId: string, creditoId: string) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.creditos = cuenta.creditos.filter((c) => c.id !== creditoId)
      this.persist()
    },
    eliminarAbono(cuentaId: string, abonoId: string) {
      const cuenta = this.cuentas.find((c) => c.id === cuentaId)
      if (!cuenta) return
      cuenta.abonos = cuenta.abonos.filter((a) => a.id !== abonoId)
      this.persist()
    },
    reemplazarCuentasDeTipo(tipo: TipoCuenta, cuentas: Cuenta[]) {
      this.cuentas = [...this.cuentas.filter((c) => c.tipo !== tipo), ...cuentas]
      this.persist()
    },
  },
})
