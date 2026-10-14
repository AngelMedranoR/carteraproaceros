import { defineStore } from 'pinia'

const STORAGE_KEY = 'cartera360.supabase.v1'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    url: '',
    anonKey: '',
    connected: false,
    lastCheckedAt: null as string | null,
    lastError: '' as string,
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
          lastCheckedAt: this.lastCheckedAt,
        })
      )
    },
    desconectar() {
      this.connected = false
      this.lastError = ''
      this.persist()
    },
    async probarConexion() {
      this.lastError = ''
      if (!this.url || !this.anonKey) {
        this.connected = false
        this.lastError = 'Completa la URL del proyecto y la anon key de Supabase.'
        return false
      }
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const client = createClient(this.url, this.anonKey)
        const { error } = await client.auth.getSession()
        if (error) throw error
        this.connected = true
        this.lastCheckedAt = new Date().toISOString()
        this.persist()
        return true
      } catch (err: any) {
        this.connected = false
        this.lastError = err?.message || 'No se pudo conectar con Supabase. Verifica la URL y la clave.'
        this.persist()
        return false
      }
    },
  },
})
