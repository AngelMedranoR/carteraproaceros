-- ==============================================================================
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
-- Permitir lectura, inserción, actualización y eliminación de cuentas
drop policy if exists "Acceso anonimo total a cuentas" on public.cuentas;
create policy "Acceso anonimo total a cuentas" on public.cuentas
  for all
  using (true)
  with check (true);

-- Permitir lectura, inserción, actualización y eliminación de creditos
drop policy if exists "Acceso anonimo total a creditos" on public.creditos;
create policy "Acceso anonimo total a creditos" on public.creditos
  for all
  using (true)
  with check (true);

-- Permitir lectura, inserción, actualización y eliminación de abonos
drop policy if exists "Acceso anonimo total a abonos" on public.abonos;
create policy "Acceso anonimo total a abonos" on public.abonos
  for all
  using (true)
  with check (true);

-- Notificación de esquema listo
comment on table public.cuentas is 'Cuentas de clientes y proveedores de Cartera 360';
comment on table public.creditos is 'Facturas de crédito (por cobrar o por pagar) de Cartera 360';
comment on table public.abonos is 'Abonos y cobros registrados de Cartera 360';
