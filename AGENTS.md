# AGENTS.md

Guía para futuras sesiones de agentes trabajando en Cartera 360.

## Arquitectura

App Nuxt 3 en modo SPA (`ssr: false` en `nuxt.config.ts`) — no hay rutas de
servidor todavía. Todo el estado vive en dos stores de Pinia
(`stores/accounts.ts`, `stores/settings.ts`) que se persisten en
`localStorage` del navegador. No hay base de datos ni backend propio; ver
`PLAN.md` para el roadmap de cuándo y cómo se agrega (Netlify DB + Drizzle).

## Modelo de datos

Ver `types/index.ts`. Una `Cuenta` (cliente o proveedor) tiene una lista de
`Credito` (facturas) y una lista de `Abono` (pagos). El saldo pendiente se
calcula siempre como `sum(creditos.montoDivisas) - sum(abonos.montoDivisas)`
(ver `composables/useAccountStatus.ts`); no se guarda como campo aparte.
Todos los montos tienen una divisa (USD) obligatoria y bolívares opcional —
la divisa es la moneda "de verdad" para saldos y comparaciones, siguiendo el
formato de las planillas de Excel originales del negocio.

## Importación de Excel

`composables/useExcel.ts` no asume posiciones de columna fijas: busca en las
primeras filas de cada hoja los encabezados ("Fecha de factura", "Monto de
abono en divisas", etc.) y a partir de ahí lee las filas. Esto es porque las
planillas reales tienen hojas con distinto ancho de columnas iniciales. Las
hojas marcadas como ocultas en el archivo, y cualquier hoja cuyo nombre
empiece con "Resumen", se omiten siempre (`esHojaResumen`).

## Convenciones

- Toda la UI y el código de negocio están en español (nombres de variables,
  rutas, textos) porque así lo pidió el usuario para su negocio.
- Los montos en pantalla siempre usan `font-figures` (IBM Plex Mono,
  tabular) — ver `assets/css/main.css`. Los títulos usan `font-display`
  (Fraunces).
- Color por identidad, no por estado: ámbar/`--cobrar` es siempre "por
  cobrar" y azul/`--pagar` es siempre "por pagar" en toda la app (KPIs,
  gráficos, botones). Los colores de estado (`--status-good/warning/critical`)
  son independientes y se usan solo en `StatusBadge`.
- Componentes y composables se auto-importan (convención Nuxt): no hace
  falta `import` explícito para nada dentro de `components/`, `composables/`
  o `stores/`.

## Próximos pasos

Ver `PLAN.md` para los milestones pendientes (backend con Netlify DB, cuentas
de usuario, sincronización real con Supabase, reportes).
