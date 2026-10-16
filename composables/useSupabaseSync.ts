import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Cuenta, Credito, Abono, SyncResult, TipoCuenta } from '~/types'

let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedKey = ''
let realtimeChannel: RealtimeChannel | null = null
let channelSubscribed = false
let initializing = false

// Supabase devuelve como máximo 1000 filas por consulta y rechaza peticiones
// muy grandes, así que se lee y se escribe por lotes.
const TAMANO_LOTE = 500

function filaCredito(cuentaId: string, cr: Credito) {
  return {
    id: cr.id,
    cuenta_id: cuentaId,
    // Las planillas a veces traen facturas sin fecha: se guardan como null
    // porque Postgres no acepta '' en una columna date.
    fecha: cr.fecha || null,
    numero_factura: cr.numeroFactura || '',
    monto_bolivares: cr.montoBolivares,
    monto_divisas: cr.montoDivisas,
    tasa_cambio: cr.tasaCambio ?? null,
    fecha_vencimiento: cr.fechaVencimiento || null,
    dias_credito: cr.diasCredito ?? null,
    descripcion: cr.descripcion ?? '',
  }
}

function filaAbono(cuentaId: string, ab: Abono) {
  return {
    id: ab.id,
    cuenta_id: cuentaId,
    fecha: ab.fecha || null,
    monto_bolivares: ab.montoBolivares,
    monto_divisas: ab.montoDivisas,
    tasa_cambio: ab.tasaCambio ?? null,
    comentario: ab.comentario || '',
  }
}

function filaCuenta(c: Cuenta) {
  return { id: c.id, nombre: c.nombre, tipo: c.tipo, updated_at: new Date().toISOString() }
}

async function upsertEnLotes(client: SupabaseClient, tabla: string, filas: any[]) {
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const { error } = await client.from(tabla).upsert(filas.slice(i, i + TAMANO_LOTE), { onConflict: 'id' })
    if (error) throw error
  }
}

async function seleccionarTodo(client: SupabaseClient, tabla: string, orden: string) {
  const filas: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await client
      .from(tabla)
      .select('*')
      .order(orden)
      .order('id')
      .range(desde, desde + 999)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < 1000) return filas
  }
}

function mensajeDeError(err: any, porDefecto: string) {
  const msg: string = err?.message || porDefecto
  // Bases creadas con la versión anterior del script exigen fecha en todas las filas
  if (err?.code === '23502' && msg.includes('fecha')) {
    return 'Hay facturas o abonos sin fecha y tu base de Supabase todavía no los admite. Vuelve a ejecutar el script SQL (Ajustes) y sincroniza de nuevo.'
  }
  return msg
}

async function subirCuentas(client: SupabaseClient, cuentas: Cuenta[]) {
  const creditosRows = cuentas.flatMap((c) => c.creditos.map((cr) => filaCredito(c.id, cr)))
  const abonosRows = cuentas.flatMap((c) => c.abonos.map((ab) => filaAbono(c.id, ab)))
  // Upsert en orden relacional
  await upsertEnLotes(client, 'cuentas', cuentas.map(filaCuenta))
  await upsertEnLotes(client, 'creditos', creditosRows)
  await upsertEnLotes(client, 'abonos', abonosRows)
  return { cuentasCount: cuentas.length, creditosCount: creditosRows.length, abonosCount: abonosRows.length }
}

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

-- Las planillas pueden traer facturas o abonos sin fecha (bases creadas antes de este cambio)
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

      const { cuentasCount, creditosCount, abonosCount } = await subirCuentas(client, cuentas)

      settings.setSyncStatus('success')
      settings.lastSyncAt = new Date().toISOString()
      settings.persist()

      return {
        ok: true,
        mensaje: `Respaldo exitoso: ${cuentasCount} cuentas, ${creditosCount} facturas y ${abonosCount} abonos subidos a la nube.`,
        cuentasCount,
        creditosCount,
        abonosCount,
      }
    } catch (err: any) {
      settings.setSyncStatus('error')
      const msg = mensajeDeError(err, 'Error al subir los datos a Supabase.')
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

      const [rawCuentas, rawCreditos, rawAbonos] = await Promise.all([
        seleccionarTodo(client, 'cuentas', 'nombre'),
        seleccionarTodo(client, 'creditos', 'fecha'),
        seleccionarTodo(client, 'abonos', 'fecha'),
      ])

      // Reconstruir estructura de datos de Cartera 360
      const cuentasReconstruidas: Cuenta[] = rawCuentas.map((c) => {
        const creditosCuenta: Credito[] = rawCreditos
          .filter((cr) => cr.cuenta_id === c.id)
          .map((cr) => ({
            id: cr.id,
            fecha: cr.fecha || '',
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
            fecha: ab.fecha || '',
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
      await client.from('cuentas').upsert(filaCuenta(cuenta), { onConflict: 'id' })
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
      await client.from('creditos').upsert(filaCredito(cuentaId, credito), { onConflict: 'id' })
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
      await client.from('abonos').upsert(filaAbono(cuentaId, abono), { onConflict: 'id' })
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

  // Al importar un Excel se reemplazan todas las cuentas de ese tipo: se suben
  // las nuevas (con sus facturas y abonos) y luego se borran de la nube las
  // anteriores, para que los demás dispositivos vean exactamente lo importado.
  const reemplazarTipoEnLaNube = async (tipo: TipoCuenta, cuentas: Cuenta[]): Promise<SyncResult | null> => {
    if (!settings.connected || !settings.tablesReady || !settings.autoSync) return null
    try {
      settings.setSyncStatus('syncing')
      const client = await getClient()
      if (!client) return null

      const conteo = await subirCuentas(client, cuentas)

      const nuevas = new Set(cuentas.map((c) => c.id))
      const existentes = await seleccionarTodo(client, 'cuentas', 'id')
      const obsoletas = existentes.filter((c) => c.tipo === tipo && !nuevas.has(c.id)).map((c) => c.id)
      for (let i = 0; i < obsoletas.length; i += 100) {
        const { error } = await client.from('cuentas').delete().in('id', obsoletas.slice(i, i + 100))
        if (error) throw error
      }

      settings.setSyncStatus('success')
      settings.lastSyncAt = new Date().toISOString()
      settings.persist()
      return {
        ok: true,
        mensaje: `${conteo.cuentasCount} cuentas, ${conteo.creditosCount} facturas y ${conteo.abonosCount} abonos subidos a la nube.`,
        ...conteo,
      }
    } catch (err: any) {
      settings.setSyncStatus('error')
      const msg = mensajeDeError(err, 'Error al subir la importación a Supabase.')
      settings.lastError = msg
      settings.persist()
      return { ok: false, mensaje: msg, error: msg }
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
    descargarDeSupabase,
    sincronizar,
    iniciarSuscripcionRealtime,
    detenerSuscripcionRealtime,
    inicializarSincronizacion,
    sincronizarCuentaEnSegundoPlano,
    eliminarCuentaEnSegundoPlano,
    sincronizarCreditoEnSegundoPlano,
    eliminarCreditoEnSegundoPlano,
    sincronizarAbonoEnSegundoPlano,
    eliminarAbonoEnSegundoPlano,
    reemplazarTipoEnLaNube,
    scriptSql: SCRIPT_SQL_SUPABASE,
  }
}
