import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Cuenta, Credito, Abono, SyncResult } from '~/types'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''
let realtimeChannel: RealtimeChannel | null = null
let channelSubscribed = false
let initializing = false

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
  fecha date,
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
  fecha date,
  monto_bolivares numeric,
  monto_divisas numeric not null default 0,
  tasa_cambio numeric,
  comentario text default '' not null,
  created_at timestamptz default now() not null
);

-- Actualizar tablas existentes para permitir registros sin fecha de planillas Excel
alter table public.creditos alter column fecha drop not null;
alter table public.abonos alter column fecha drop not null;

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

-- 7. Habilitar Tiempo Real (Realtime) para sincronización multidispositivo instantánea
-- Permite que los cambios se transmitan por WebSocket a todos los teléfonos y navegadores conectados
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cuentas'
  ) then
    alter publication supabase_realtime add table public.cuentas;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'creditos'
  ) then
    alter publication supabase_realtime add table public.creditos;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'abonos'
  ) then
    alter publication supabase_realtime add table public.abonos;
  end if;
end $$;

-- Replica Identity Full para que las eliminaciones envíen la fila completa
alter table public.cuentas replica identity full;
alter table public.creditos replica identity full;
alter table public.abonos replica identity full;
`

function sanitizeYear(y: number): number {
  if (y >= 1990 && y <= 2099) return y
  const yStr = String(y)
  if (yStr.includes('2026') || yStr.includes('26')) return 2026
  if (yStr.length === 5 && yStr.startsWith('2')) return 2026
  if (y >= 20000 && y <= 29999) return 2026
  if (y >= 2100 && y <= 2999) return 2026
  return 2026
}

export function sanitizeDate(v: unknown): string | null {
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
    const dmyMatch = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,5})/)
    if (isoMatch) {
      y = sanitizeYear(parseInt(isoMatch[1], 10))
      m = parseInt(isoMatch[2], 10)
      d = parseInt(isoMatch[3], 10)
    } else if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10)
      m = parseInt(dmyMatch[2], 10)
      let rawYear = parseInt(dmyMatch[3], 10)
      if (rawYear < 100) rawYear += 2000
      y = sanitizeYear(rawYear)
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

  // Si mes > 12 y día <= 12, intercambiar mes y día (ej. 2026-28-04 o 04/28/2026)
  if (m > 12 && d <= 12 && m <= 31) {
    const temp = m
    m = d
    d = temp
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  orderCol = 'id'
): Promise<any[]> {
  const allRows: any[] = []
  const pageSize = 1000
  let from = 0
  let keepGoing = true

  while (keepGoing) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(orderCol, { ascending: true })
      .range(from, to)

    if (error) throw error

    if (!data || data.length === 0) {
      keepGoing = false
    } else {
      allRows.push(...data)
      if (data.length < pageSize) {
        keepGoing = false
      } else {
        from += pageSize
      }
    }
  }

  return allRows
}

async function upsertInBatches(
  client: SupabaseClient,
  table: string,
  rows: any[],
  chunkSize = 100
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0
  const errors: string[] = []
  if (rows.length === 0) return { inserted, errors }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' })
    if (!error) {
      inserted += chunk.length
    } else {
      console.warn(`Lote de ${chunk.length} filas en ${table} falló (${error.message}). Reintentando fila por fila...`)
      for (const row of chunk) {
        const { error: singleErr } = await client.from(table).upsert(row, { onConflict: 'id' })
        if (!singleErr) {
          inserted++
        } else {
          console.error(`Error en fila individual de ${table} [${row.id}]:`, singleErr.message, row)
          errors.push(`${table} [${row.id}]: ${singleErr.message}`)
        }
      }
    }
  }

  return { inserted, errors }
}

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

      // 2. Verificar si las tablas del esquema existen y son accesibles
      const [resCuentas, resCreditos, resAbonos] = await Promise.all([
        client.from('cuentas').select('id').limit(1),
        client.from('creditos').select('id').limit(1),
        client.from('abonos').select('id').limit(1),
      ])

      const errTablas = resCuentas.error || resCreditos.error || resAbonos.error
      if (errTablas) {
        // Código 42P01 indica "relation does not exist" en Postgres
        const faltanTablas =
          errTablas.code === '42P01' ||
          errTablas.message.toLowerCase().includes('does not exist') ||
          errTablas.message.toLowerCase().includes('not found')

        if (faltanTablas) {
          settings.connected = true
          settings.tablesReady = false
          settings.lastCheckedAt = new Date().toISOString()
          settings.lastError = 'Conexión exitosa, pero faltan tablas en Supabase. Ejecuta el script SQL en Supabase.'
          settings.persist()
          return {
            ok: true,
            tablesReady: false,
            mensaje: settings.lastError,
          }
        }

        throw new Error(errTablas.message)
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
      return { ok: false, mensaje: settings.lastError, tablesReady: false }
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

      // Mapear Créditos con fechas saneadas
      const creditosRows: any[] = []
      for (const c of cuentas) {
        for (const cr of c.creditos) {
          creditosRows.push({
            id: cr.id,
            cuenta_id: c.id,
            fecha: sanitizeDate(cr.fecha) || getTodayDateString(),
            numero_factura: cr.numeroFactura || '',
            monto_bolivares:
              cr.montoBolivares !== null && !isNaN(Number(cr.montoBolivares))
                ? Number(cr.montoBolivares)
                : null,
            monto_divisas: Number(cr.montoDivisas) || 0,
            tasa_cambio:
              cr.tasaCambio !== null && !isNaN(Number(cr.tasaCambio))
                ? Number(cr.tasaCambio)
                : null,
            fecha_vencimiento: sanitizeDate(cr.fechaVencimiento),
            dias_credito:
              cr.diasCredito !== null && !isNaN(Number(cr.diasCredito))
                ? Math.round(Number(cr.diasCredito))
                : null,
            descripcion: cr.descripcion ?? '',
          })
        }
      }

      // Mapear Abonos con fechas saneadas
      const abonosRows: any[] = []
      for (const c of cuentas) {
        for (const ab of c.abonos) {
          abonosRows.push({
            id: ab.id,
            cuenta_id: c.id,
            fecha: sanitizeDate(ab.fecha) || getTodayDateString(),
            monto_bolivares:
              ab.montoBolivares !== null && !isNaN(Number(ab.montoBolivares))
                ? Number(ab.montoBolivares)
                : null,
            monto_divisas: Number(ab.montoDivisas) || 0,
            tasa_cambio:
              ab.tasaCambio !== null && !isNaN(Number(ab.tasaCambio))
                ? Number(ab.tasaCambio)
                : null,
            comentario: ab.comentario || '',
          })
        }
      }

      // Upsert en orden relacional con procesamiento resiliente por lotes
      const resCuentas = await upsertInBatches(client, 'cuentas', cuentasRows)
      const resCreditos = await upsertInBatches(client, 'creditos', creditosRows)
      const resAbonos = await upsertInBatches(client, 'abonos', abonosRows)

      const totalErrors = [...resCuentas.errors, ...resCreditos.errors, ...resAbonos.errors]

      settings.setSyncStatus('success')
      settings.lastSyncAt = new Date().toISOString()
      settings.persist()

      // Notificar a otros dispositivos (ej: teléfonos) por WebSocket
      await emitirEventoBulkSync()

      return {
        ok: true,
        mensaje: `Respaldo exitoso: ${resCuentas.inserted} cuentas, ${resCreditos.inserted} facturas y ${resAbonos.inserted} abonos subidos a la nube.${totalErrors.length > 0 ? ` (${totalErrors.length} filas omitidas por conflicto)` : ''}`,
        cuentasCount: resCuentas.inserted,
        creditosCount: resCreditos.inserted,
        abonosCount: resAbonos.inserted,
      }
    } catch (err: any) {
      console.error('Error al subir a Supabase:', err)
      settings.setSyncStatus('error')
      const msg = err?.message || err?.details || 'Error al subir los datos a Supabase.'
      settings.lastError = msg
      settings.persist()
      return { ok: false, mensaje: msg, error: msg }
    }
  }

  const sincronizarLote = async (datos: {
    cuentas: Cuenta[]
    creditos: Array<{ cuentaId: string; credito: Credito }>
    abonos: Array<{ cuentaId: string; abono: Abono }>
  }): Promise<SyncResult> => {
    try {
      const client = await getClient()
      if (!client) throw new Error('Supabase no está configurado.')

      const cuentasRows = datos.cuentas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        updated_at: new Date().toISOString(),
      }))

      const creditosRows = datos.creditos.map(({ cuentaId, credito: cr }) => ({
        id: cr.id,
        cuenta_id: cuentaId,
        fecha: sanitizeDate(cr.fecha) || getTodayDateString(),
        numero_factura: cr.numeroFactura || '',
        monto_bolivares:
          cr.montoBolivares !== null && !isNaN(Number(cr.montoBolivares))
            ? Number(cr.montoBolivares)
            : null,
        monto_divisas: Number(cr.montoDivisas) || 0,
        tasa_cambio:
          cr.tasaCambio !== null && !isNaN(Number(cr.tasaCambio))
            ? Number(cr.tasaCambio)
            : null,
        fecha_vencimiento: sanitizeDate(cr.fechaVencimiento),
        dias_credito:
          cr.diasCredito !== null && !isNaN(Number(cr.diasCredito))
            ? Math.round(Number(cr.diasCredito))
            : null,
        descripcion: cr.descripcion ?? '',
      }))

      const abonosRows = datos.abonos.map(({ cuentaId, abono: ab }) => ({
        id: ab.id,
        cuenta_id: cuentaId,
        fecha: sanitizeDate(ab.fecha) || getTodayDateString(),
        monto_bolivares:
          ab.montoBolivares !== null && !isNaN(Number(ab.montoBolivares))
            ? Number(ab.montoBolivares)
            : null,
        monto_divisas: Number(ab.montoDivisas) || 0,
        tasa_cambio:
          ab.tasaCambio !== null && !isNaN(Number(ab.tasaCambio))
            ? Number(ab.tasaCambio)
            : null,
        comentario: ab.comentario || '',
      }))

      const resCuentas = await upsertInBatches(client, 'cuentas', cuentasRows)
      const resCreditos = await upsertInBatches(client, 'creditos', creditosRows)
      const resAbonos = await upsertInBatches(client, 'abonos', abonosRows)

      const totalErrors = [...resCuentas.errors, ...resCreditos.errors, ...resAbonos.errors]

      settings.lastSyncAt = new Date().toISOString()
      settings.persist()

      // Notificar a otros dispositivos (teléfonos) para recarga en vivo
      await emitirEventoBulkSync()

      return {
        ok: true,
        mensaje: `Sincronizados en la nube: ${resCuentas.inserted} cuentas, ${resCreditos.inserted} facturas y ${resAbonos.inserted} abonos.${totalErrors.length > 0 ? ` (${totalErrors.length} filas omitidas por conflicto)` : ''}`,
        cuentasCount: resCuentas.inserted,
        creditosCount: resCreditos.inserted,
        abonosCount: resAbonos.inserted,
      }
    } catch (err: any) {
      console.error('Error al sincronizar lote en Supabase:', err)
      const msg = err?.message || err?.details || 'Error al guardar el lote en Supabase.'
      return { ok: false, mensaje: msg, error: msg }
    }
  }

  const descargarDeSupabase = async (): Promise<SyncResult> => {
    try {
      settings.setSyncStatus('syncing')
      const client = await getClient()
      if (!client) throw new Error('Supabase no está configurado.')

      const [rawCuentas, rawCreditos, rawAbonos] = await Promise.all([
        fetchAllRows(client, 'cuentas', 'id'),
        fetchAllRows(client, 'creditos', 'id'),
        fetchAllRows(client, 'abonos', 'id'),
      ])

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
          fecha: sanitizeDate(credito.fecha) || getTodayDateString(),
          numero_factura: credito.numeroFactura || '',
          monto_bolivares:
            credito.montoBolivares !== null && !isNaN(Number(credito.montoBolivares))
              ? Number(credito.montoBolivares)
              : null,
          monto_divisas: Number(credito.montoDivisas) || 0,
          tasa_cambio:
            credito.tasaCambio !== null && !isNaN(Number(credito.tasaCambio))
              ? Number(credito.tasaCambio)
              : null,
          fecha_vencimiento: sanitizeDate(credito.fechaVencimiento),
          dias_credito:
            credito.diasCredito !== null && !isNaN(Number(credito.diasCredito))
              ? Math.round(Number(credito.diasCredito))
              : null,
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
          fecha: sanitizeDate(abono.fecha) || getTodayDateString(),
          monto_bolivares:
            abono.montoBolivares !== null && !isNaN(Number(abono.montoBolivares))
              ? Number(abono.montoBolivares)
              : null,
          monto_divisas: Number(abono.montoDivisas) || 0,
          tasa_cambio:
            abono.tasaCambio !== null && !isNaN(Number(abono.tasaCambio))
              ? Number(abono.tasaCambio)
              : null,
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

  const iniciarSuscripcionRealtime = async () => {
    try {
      const client = await getClient()
      if (!client) return

      if (realtimeChannel && channelSubscribed) {
        settings.setRealtimeActivo(true)
        return realtimeChannel
      }

      if (realtimeChannel) {
        try {
          await client.removeChannel(realtimeChannel)
        } catch {}
        realtimeChannel = null
        channelSubscribed = false
      }

      const channel = client
        .channel('cartera360-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cuentas' },
          (payload) => {
            accountsStore.manejarEventoRealtimeCuentas(payload as any)
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'creditos' },
          (payload) => {
            accountsStore.manejarEventoRealtimeCreditos(payload as any)
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'abonos' },
          (payload) => {
            accountsStore.manejarEventoRealtimeAbonos(payload as any)
          }
        )
        .on(
          'broadcast',
          { event: 'bulk-sync' },
          () => {
            // Notificación de que otro dispositivo (ej: la PC) importó un lote masivo
            solicitarReconciliacionDebounced()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channelSubscribed = true
            settings.setRealtimeActivo(true)
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            channelSubscribed = false
            settings.setRealtimeActivo(false)
          }
        })

      realtimeChannel = channel
      return channel
    } catch (e) {
      console.warn('Error al iniciar suscripción Realtime:', e)
      settings.setRealtimeActivo(false)
    }
  }

  const emitirEventoBulkSync = async () => {
    if (!realtimeChannel || !channelSubscribed) return
    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'bulk-sync',
        payload: { timestamp: new Date().toISOString() },
      })
    } catch (e) {
      console.warn('Error al emitir broadcast bulk-sync:', e)
    }
  }

  let reconciliacionTimer: any = null
  const solicitarReconciliacionDebounced = () => {
    if (reconciliacionTimer) clearTimeout(reconciliacionTimer)
    reconciliacionTimer = setTimeout(async () => {
      try {
        await descargarDeSupabase()
      } catch (e) {
        console.warn('Reconciliación debounced error:', e)
      }
    }, 350)
  }

  const procesarCredencialesDesdeUrl = () => {
    if (typeof window === 'undefined') return false
    try {
      const params = new URLSearchParams(window.location.search)
      const urlParam = params.get('s_url') || params.get('supabase_url')
      const keyParam = params.get('s_key') || params.get('supabase_key')
      if (urlParam && keyParam) {
        settings.guardarConfiguracionSupabase(urlParam.trim(), keyParam.trim(), true)
        const cleanUrl = window.location.pathname + window.location.hash
        window.history.replaceState({}, document.title, cleanUrl)
        return true
      }
    } catch {}
    return false
  }

  const detenerSuscripcionRealtime = async () => {
    if (!realtimeChannel) return
    try {
      const client = await getClient()
      if (client) {
        await client.removeChannel(realtimeChannel)
      }
    } catch {}
    realtimeChannel = null
    channelSubscribed = false
    settings.setRealtimeActivo(false)
  }

  const inicializarSincronizacion = async () => {
    if (initializing) return
    initializing = true
    try {
      // 1. Detectar si el usuario abrió un enlace de vinculación en su teléfono
      procesarCredencialesDesdeUrl()

      const { url, anonKey } = getEffectiveCredentials()
      if (!url || !anonKey) {
        settings.connected = false
        settings.tablesReady = false
        settings.setRealtimeActivo(false)
        return
      }

      // Probar conexión y tablas en Supabase
      const check = await probarConexion()
      if (!check.ok || !check.tablesReady) {
        return
      }

      // Descargar el estado consolidado de la nube al iniciar para que
      // cualquier cambio hecho desde otro teléfono esté disponible de inmediato
      await descargarDeSupabase()

      // Iniciar el canal de transmisión en vivo
      await iniciarSuscripcionRealtime()
    } catch (e) {
      console.warn('Error durante inicialización de sincronización:', e)
    } finally {
      initializing = false
    }
  }

  return {
    getClient,
    probarConexion,
    subirASupabase,
    sincronizarLote,
    descargarDeSupabase,
    sincronizar,
    iniciarSuscripcionRealtime,
    detenerSuscripcionRealtime,
    inicializarSincronizacion,
    emitirEventoBulkSync,
    solicitarReconciliacionDebounced,
    procesarCredencialesDesdeUrl,
    sincronizarCuentaEnSegundoPlano,
    eliminarCuentaEnSegundoPlano,
    sincronizarCreditoEnSegundoPlano,
    eliminarCreditoEnSegundoPlano,
    sincronizarAbonoEnSegundoPlano,
    eliminarAbonoEnSegundoPlano,
    scriptSql: SCRIPT_SQL_SUPABASE,
  }
}
