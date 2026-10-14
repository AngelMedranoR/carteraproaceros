import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cuenta, Credito, Abono, SyncResult } from '~/types'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''

export const SCRIPT_SQL_SUPABASE = `-- ==============================================================================
-- CARTERA 360 · Esquema de Base de Datos para Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase (SQL Editor > New Query > Run)
-- ==============================================================================

-- 1. Tabla de Cuentas (Clientes y Proveedores)
create table if not exists public.cuentas (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('cliente', 'proveedor')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Tabla de Créditos (Facturas por cobrar o por pagar)
create table if not exists public.creditos (
  id text primary key,
  cuenta_id text not null references public.cuentas(id) on delete cascade,
  fecha date not null,
  numero_factura text default '' not null,
  monto_bolivares numeric,
  monto_divisas numeric not null default 0,
  tasa_cambio numeric,
  fecha_vencimiento date,
  dias_credito integer,
  descripcion text default '',
  created_at timestamptz default now() not null
);

-- 3. Tabla de Abonos (Cobros de clientes o pagos a proveedores)
create table if not exists public.abonos (
  id text primary key,
  cuenta_id text not null references public.cuentas(id) on delete cascade,
  fecha date not null,
  monto_bolivares numeric,
  monto_divisas numeric not null default 0,
  tasa_cambio numeric,
  comentario text default '' not null,
  created_at timestamptz default now() not null
);

-- 4. Índices para acelerar consultas y ordenamiento
create index if not exists idx_creditos_cuenta_id on public.creditos(cuenta_id);
create index if not exists idx_creditos_fecha on public.creditos(fecha);
create index if not exists idx_creditos_fecha_vencimiento on public.creditos(fecha_vencimiento);
create index if not exists idx_abonos_cuenta_id on public.abonos(cuenta_id);
create index if not exists idx_abonos_fecha on public.abonos(fecha);
create index if not exists idx_cuentas_tipo on public.cuentas(tipo);

-- 5. Habilitar Row Level Security (RLS)
alter table public.cuentas enable row level security;
alter table public.creditos enable row level security;
alter table public.abonos enable row level security;

-- 6. Políticas de acceso para clave pública (anon key)
drop policy if exists "Acceso anonimo total a cuentas" on public.cuentas;
create policy "Acceso anonimo total a cuentas" on public.cuentas
  for all
  using (true)
  with check (true);

drop policy if exists "Acceso anonimo total a creditos" on public.creditos;
create policy "Acceso anonimo total a creditos" on public.creditos
  for all
  using (true)
  with check (true);

drop policy if exists "Acceso anonimo total a abonos" on public.abonos;
create policy "Acceso anonimo total a abonos" on public.abonos
  for all
  using (true)
  with check (true);
`

export function useSupabaseSync() {
  const settings = useSettingsStore()
  const accountsStore = useAccountsStore()
  const runtimeConfig = useRuntimeConfig()

  const getEffectiveCredentials = () => {
    settings.hydrate()
    const url = settings.url || (runtimeConfig.public.supabaseUrl as string) || ''
    const anonKey = settings.anonKey || (runtimeConfig.public.supabaseAnonKey as string) || ''
    return { url: url.trim(), anonKey: anonKey.trim() }
  }

  const getClient = async (): Promise<SupabaseClient | null> => {
    const { url, anonKey } = getEffectiveCredentials()
    if (!url || !anonKey) return null

    if (cachedClient && cachedUrl === url && cachedKey === anonKey) {
      return cachedClient
    }

    const { createClient } = await import('@supabase/supabase-js')
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    })
    cachedUrl = url
    cachedKey = anonKey
    return cachedClient
  }

  const probarConexion = async (): Promise<{ ok: boolean; tablesReady: boolean; mensaje: string }> => {
    const { url, anonKey } = getEffectiveCredentials()
    if (!url || !anonKey) {
      settings.connected = false
      settings.tablesReady = false
      settings.lastError = 'Indica la URL del proyecto y la Anon Key de Supabase.'
      settings.persist()
      return { ok: false, tablesReady: false, mensaje: settings.lastError }
    }

    try {
      const client = await getClient()
      if (!client) throw new Error('No se pudo inicializar el cliente de Supabase.')

      // 1. Probar conectividad con Supabase Auth/API
      const { error: authError } = await client.auth.getSession()
      if (authError && authError.status !== 400 && authError.status !== 404) {
        // Ignorar si no hay sesión activa, solo verificar que responde
      }

      // 2. Verificar si las tablas del esquema existen
      const { error: cuentasErr } = await client.from('cuentas').select('id').limit(1)

      if (cuentasErr) {
        // Código 42P01 indica "relation does not exist" en Postgres
        const faltanTablas =
          cuentasErr.code === '42P01' ||
          cuentasErr.message.toLowerCase().includes('does not exist') ||
          cuentasErr.message.toLowerCase().includes('not found')

        if (faltanTablas) {
          settings.connected = true
          settings.tablesReady = false
          settings.lastCheckedAt = new Date().toISOString()
          settings.lastError = 'Conexión exitosa, pero las tablas aún no existen. Ejecuta el script SQL en Supabase.'
          settings.persist()
          return {
            ok: true,
            tablesReady: false,
            mensaje: settings.lastError,
          }
        }

        throw new Error(cuentasErr.message)
      }

      // Tablas disponibles y conexión 100% operativa
      settings.connected = true
      settings.tablesReady = true
      settings.lastCheckedAt = new Date().toISOString()
      settings.lastError = ''
      settings.persist()

      return {
        ok: true,
        tablesReady: true,
        mensaje: 'Conexión exitosa y tablas listas para sincronizar.',
      }
    } catch (err: any) {
      settings.connected = false
      settings.tablesReady = false
      settings.lastError = err?.message || 'Error al conectar con Supabase. Revisa la URL y la Anon Key.'
      settings.persist()
      return { ok: false, tablesReady: false, mensaje: settings.lastError }
    }
  }

  const subirASupabase = async (): Promise<SyncResult> => {
    try {
      settings.setSyncStatus('syncing')
      const client = await getClient()
      if (!client) throw new Error('Supabase no está configurado.')

      // Asegurar que las cuentas están hidratadas
      accountsStore.hydrate()
      const cuentas = accountsStore.cuentas

      // Mapear Cuentas
      const cuentasRows = cuentas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        updated_at: new Date().toISOString(),
      }))

      // Mapear Créditos
      const creditosRows: any[] = []
      for (const c of cuentas) {
        for (const cr of c.creditos) {
          creditosRows.push({
            id: cr.id,
            cuenta_id: c.id,
            fecha: cr.fecha,
            numero_factura: cr.numeroFactura || '',
            monto_bolivares: cr.montoBolivares,
            monto_divisas: cr.montoDivisas,
            tasa_cambio: cr.tasaCambio ?? null,
            fecha_vencimiento: cr.fechaVencimiento ?? null,
            dias_credito: cr.diasCredito ?? null,
            descripcion: cr.descripcion ?? '',
          })
        }
      }

      // Mapear Abonos
      const abonosRows: any[] = []
      for (const c of cuentas) {
        for (const ab of c.abonos) {
          abonosRows.push({
            id: ab.id,
            cuenta_id: c.id,
            fecha: ab.fecha,
            monto_bolivares: ab.montoBolivares,
            monto_divisas: ab.montoDivisas,
            tasa_cambio: ab.tasaCambio ?? null,
            comentario: ab.comentario || '',
          })
        }
      }

      // Upsert en orden relacional
      if (cuentasRows.length > 0) {
        const { error: errCuentas } = await client.from('cuentas').upsert(cuentasRows, { onConflict: 'id' })
        if (errCuentas) throw errCuentas
      }

      if (creditosRows.length > 0) {
        const { error: errCreditos } = await client.from('creditos').upsert(creditosRows, { onConflict: 'id' })
        if (errCreditos) throw errCreditos
      }

      if (abonosRows.length > 0) {
        const { error: errAbonos } = await client.from('abonos').upsert(abonosRows, { onConflict: 'id' })
        if (errAbonos) throw errAbonos
      }

      settings.setSyncStatus('success')
      settings.lastSyncAt = new Date().toISOString()
      settings.persist()

      return {
        ok: true,
        mensaje: `Respaldo exitoso: ${cuentasRows.length} cuentas, ${creditosRows.length} facturas y ${abonosRows.length} abonos subidos a la nube.`,
        cuentasCount: cuentasRows.length,
        creditosCount: creditosRows.length,
        abonosCount: abonosRows.length,
      }
    } catch (err: any) {
      settings.setSyncStatus('error')
      const msg = err?.message || 'Error al subir los datos a Supabase.'
      settings.lastError = msg
      settings.persist()
      return { ok: false, mensaje: msg, error: msg }
    }
  }

  const descargarDeSupabase = async (): Promise<SyncResult> => {
    try {
      settings.setSyncStatus('syncing')
      const client = await getClient()
      if (!client) throw new Error('Supabase no está configurado.')

      const [resCuentas, resCreditos, resAbonos] = await Promise.all([
        client.from('cuentas').select('*').order('nombre'),
        client.from('creditos').select('*').order('fecha'),
        client.from('abonos').select('*').order('fecha'),
      ])

      if (resCuentas.error) throw resCuentas.error
      if (resCreditos.error) throw resCreditos.error
      if (resAbonos.error) throw resAbonos.error

      const rawCuentas = resCuentas.data || []
      const rawCreditos = resCreditos.data || []
      const rawAbonos = resAbonos.data || []

      // Reconstruir estructura de datos de Cartera 360
      const cuentasReconstruidas: Cuenta[] = rawCuentas.map((c) => {
        const creditosCuenta: Credito[] = rawCreditos
          .filter((cr) => cr.cuenta_id === c.id)
          .map((cr) => ({
            id: cr.id,
            fecha: cr.fecha,
            numeroFactura: cr.numero_factura || '',
            montoBolivares: cr.monto_bolivares !== null ? Number(cr.monto_bolivares) : null,
            montoDivisas: Number(cr.monto_divisas) || 0,
            tasaCambio: cr.tasa_cambio !== null ? Number(cr.tasa_cambio) : null,
            fechaVencimiento: cr.fecha_vencimiento || null,
            diasCredito: cr.dias_credito !== null ? Number(cr.dias_credito) : null,
            descripcion: cr.descripcion || '',
          }))

        const abonosCuenta: Abono[] = rawAbonos
          .filter((ab) => ab.cuenta_id === c.id)
          .map((ab) => ({
            id: ab.id,
            fecha: ab.fecha,
            montoBolivares: ab.monto_bolivares !== null ? Number(ab.monto_bolivares) : null,
            montoDivisas: Number(ab.monto_divisas) || 0,
            tasaCambio: ab.tasa_cambio !== null ? Number(ab.tasa_cambio) : null,
            comentario: ab.comentario || '',
          }))

        return {
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo as 'cliente' | 'proveedor',
          creditos: creditosCuenta,
          abonos: abonosCuenta,
        }
      })

      accountsStore.reemplazarTodasLasCuentas(cuentasReconstruidas)

      settings.setSyncStatus('success')
      settings.lastSyncAt = new Date().toISOString()
      settings.persist()

      return {
        ok: true,
        mensaje: `Restauración exitosa: ${cuentasReconstruidas.length} cuentas, ${rawCreditos.length} facturas y ${rawAbonos.length} abonos descargados de Supabase.`,
        cuentasCount: cuentasReconstruidas.length,
        creditosCount: rawCreditos.length,
        abonosCount: rawAbonos.length,
      }
    } catch (err: any) {
      settings.setSyncStatus('error')
      const msg = err?.message || 'Error al descargar datos de Supabase.'
      settings.lastError = msg
      settings.persist()
      return { ok: false, mensaje: msg, error: msg }
    }
  }

  const sincronizar = async (): Promise<SyncResult> => {
    // Primero probamos o verificamos la conexión
    const check = await probarConexion()
    if (!check.ok) return { ok: false, mensaje: check.mensaje, error: check.mensaje }
    if (!check.tablesReady) return { ok: false, mensaje: check.mensaje, error: check.mensaje }

    // Sincronización: Subir los datos locales actuales para asegurar que todo esté en la nube
    const resSubida = await subirASupabase()
    if (!resSubida.ok) return resSubida

    // Descargar el estado consolidado
    return await descargarDeSupabase()
  }

  // Operaciones atómicas en segundo plano para auto-sincronización
  const sincronizarCuentaEnSegundoPlano = async (cuenta: Cuenta) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('cuentas').upsert(
        {
          id: cuenta.id,
          nombre: cuenta.nombre,
          tipo: cuenta.tipo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch (e) {
      console.warn('Auto-sync cuenta error:', e)
    }
  }

  const eliminarCuentaEnSegundoPlano = async (cuentaId: string) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('cuentas').delete().eq('id', cuentaId)
    } catch (e) {
      console.warn('Auto-sync eliminar cuenta error:', e)
    }
  }

  const sincronizarCreditoEnSegundoPlano = async (cuentaId: string, credito: Credito) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('creditos').upsert(
        {
          id: credito.id,
          cuenta_id: cuentaId,
          fecha: credito.fecha,
          numero_factura: credito.numeroFactura || '',
          monto_bolivares: credito.montoBolivares,
          monto_divisas: credito.montoDivisas,
          tasa_cambio: credito.tasaCambio ?? null,
          fecha_vencimiento: credito.fechaVencimiento ?? null,
          dias_credito: credito.diasCredito ?? null,
          descripcion: credito.descripcion ?? '',
        },
        { onConflict: 'id' }
      )
    } catch (e) {
      console.warn('Auto-sync credito error:', e)
    }
  }

  const eliminarCreditoEnSegundoPlano = async (creditoId: string) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('creditos').delete().eq('id', creditoId)
    } catch (e) {
      console.warn('Auto-sync eliminar credito error:', e)
    }
  }

  const sincronizarAbonoEnSegundoPlano = async (cuentaId: string, abono: Abono) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('abonos').upsert(
        {
          id: abono.id,
          cuenta_id: cuentaId,
          fecha: abono.fecha,
          monto_bolivares: abono.montoBolivares,
          monto_divisas: abono.montoDivisas,
          tasa_cambio: abono.tasaCambio ?? null,
          comentario: abono.comentario || '',
        },
        { onConflict: 'id' }
      )
    } catch (e) {
      console.warn('Auto-sync abono error:', e)
    }
  }

  const eliminarAbonoEnSegundoPlano = async (abonoId: string) => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return
    try {
      const client = await getClient()
      if (!client) return
      await client.from('abonos').delete().eq('id', abonoId)
    } catch (e) {
      console.warn('Auto-sync eliminar abono error:', e)
    }
  }

  return {
    getClient,
    probarConexion,
    subirASupabase,
    descargarDeSupabase,
    sincronizar,
    sincronizarCuentaEnSegundoPlano,
    eliminarCuentaEnSegundoPlano,
    sincronizarCreditoEnSegundoPlano,
    eliminarCreditoEnSegundoPlano,
    sincronizarAbonoEnSegundoPlano,
    eliminarAbonoEnSegundoPlano,
    scriptSql: SCRIPT_SQL_SUPABASE,
  }
}
