# Cartera 360

Panel administrativo para gestionar cuentas por cobrar (clientes) y cuentas por
pagar (proveedores): créditos, abonos, importación/exportación de Excel, y un
dashboard con contadores y gráficos.

## Tecnologías

- [Nuxt 3](https://nuxt.com) (Vue 3, modo SPA)
- [Nuxt UI](https://ui.nuxt.com) + Tailwind CSS para los componentes y el
  diseño responsive (móvil y escritorio)
- [Pinia](https://pinia.vuejs.org) para el estado de la aplicación,
  persistido en `localStorage`
- [Chart.js](https://www.chartjs.org) para los gráficos
- [SheetJS (xlsx)](https://www.npmjs.com/package/xlsx) para leer y escribir
  archivos Excel en el navegador
- [Supabase JS](https://supabase.com) opcional, para probar/conectar un
  proyecto propio desde Ajustes

## Cómo correr el proyecto localmente

```bash
npm install
npm run dev
```

La app se sirve como SPA (`ssr: false`), por lo que también puede
desplegarse como sitio estático.

## Estructura

- `pages/` — Panel (`/`), Clientes (`/cobrar`), Proveedores (`/pagar`),
  ficha de cuenta (`/cobrar/[id]`, `/pagar/[id]`) y Ajustes (`/ajustes`).
- `components/` — tarjetas de KPI, gráficos, tabla de cuentas, formularios de
  crédito/abono, panel de importar/exportar.
- `stores/` — `accounts.ts` (cuentas, créditos, abonos) y `settings.ts`
  (conexión a Supabase), ambos persistidos en `localStorage`.
- `composables/useExcel.ts` — lógica de importación/exportación de Excel:
  detecta las columnas de cada hoja (CRÉDITOS/ABONOS) e ignora las hojas
  ocultas y las de resumen.
- `data/fixtures.ts` — datos de ejemplo que se cargan la primera vez que se
  abre la app (antes de importar un Excel propio).

## Importar tus propios archivos

Desde "Clientes" o "Proveedores", usa el botón **Importar** del panel de
Excel y sube tu archivo `.xlsx`. Se espera una hoja por cliente/proveedor con
dos tablas: **CRÉDITOS** (fecha de factura, número, monto en bolívares y en
divisas) y **ABONOS** (fecha, monto en bolívares y en divisas, comentario).
Las hojas ocultas y las de "resumen" se ignoran automáticamente.

## Qué falta

El roadmap completo (backend compartido con Netlify DB, cuentas de usuario,
sincronización con Supabase, reportes) está en [`PLAN.md`](./PLAN.md).
