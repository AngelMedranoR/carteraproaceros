import { defineStore } from 'pinia'
import type { SyncStatus } from '~/types'

const STORAGE_KEY = 'cartera360.supabase.v1'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    url: '',
    anonKey: '',
    connected: false,
    tablesReady: false,
    lastCheckedAt: null as string | null,
    lastSyncAt: null as string | null,
    autoSync: true,
    syncStatus: 'idle' as SyncStatus,
    lastError: '' as string,
    diasAlertaVencimiento: 5,
    diasCreditoPorDefecto: 15,
    diasAlertaCobro: 5,
    diasCreditoCliente: 15,
    hydrated: false,
  }),
  actions: {
    hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      if (typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) Object.assign(this, JSON.parse(raw))
      } catch {
        // ignore corrupt storage
      }
    },
    persist() {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          url: this.url,
          anonKey: this.anonKey,
          connected: this.connected,
          tablesReady: this.tablesReady,
          lastCheckedAt: this.lastCheckedAt,
          lastSyncAt: this.lastSyncAt,
          autoSync: this.autoSync,
          diasAlertaVencimiento: this.diasAlertaVencimiento,
          diasCreditoPorDefecto: this.diasCreditoPorDefecto,
          diasAlertaCobro: this.diasAlertaCobro,
          diasCreditoCliente: this.diasCreditoCliente,
        })
      )
    },
    guardarConfiguracionAlertas(
      diasAlertaPagar: number,
      diasCreditoPagar?: number,
      diasAlertaCobrar?: number,
      diasCreditoCobrar?: number
    ) {
      this.diasAlertaVencimiento = Math.max(1, Number(diasAlertaPagar) || 5)
      if (diasCreditoPagar !== undefined) {
        this.diasCreditoPorDefecto = Math.max(0, Number(diasCreditoPagar) || 15)
      }
      if (diasAlertaCobrar !== undefined) {
        this.diasAlertaCobro = Math.max(1, Number(diasAlertaCobrar) || 5)
      }
      if (diasCreditoCobrar !== undefined) {
        this.diasCreditoCliente = Math.max(0, Number(diasCreditoCobrar) || 15)
      }
      this.persist()
    },
    guardarConfiguracionSupabase(url: string, anonKey: string, autoSync?: boolean) {
      this.url = url.trim()
      this.anonKey = anonKey.trim()
      if (autoSync !== undefined) {
        this.autoSync = autoSync
      }
      this.persist()
    },
    setSyncStatus(status: SyncStatus) {
      this.syncStatus = status
    },
    desconectar() {
      this.connected = false
      this.tablesReady = false
      this.lastError = ''
      this.syncStatus = 'idle'
      this.persist()
    },
  },
})

