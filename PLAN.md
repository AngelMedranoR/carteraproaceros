# Plan del producto — Cartera 360

Cartera 360 es el panel para administrar cuentas por cobrar (clientes) y cuentas por
pagar (proveedores): créditos, abonos, importación/exportación de Excel y un
panel con gráficos y contadores.

## Milestone 1 — Superficie del producto (listo)

- Panel (dashboard) con contadores (por cobrar, por pagar, saldo neto, cuentas
  vencidas) y gráficos (top deudores, top acreedores, tendencia mensual de
  créditos vs. abonos, composición de la cartera).
- Listado de clientes y de proveedores, con búsqueda, orden por saldo y estado
  (al día / pendiente / vencido).
- Ficha de cuenta con historial de créditos y abonos, y formularios dedicados
  para registrar cada uno.
- Importación de Excel (.xlsx) leyendo cada hoja como una cuenta, ignorando
  automáticamente las hojas ocultas y las hojas de "resumen"; exportación a
  Excel con el mismo formato.
- Ajustes: prueba de conexión a Supabase (URL + anon key) y gestión de los
  datos locales (restaurar ejemplo / vaciar todo).
- Los datos se guardan en el navegador (localStorage) para que el trabajo no
  se pierda entre sesiones mientras se construye el backend compartido.

## Milestone 2 — Backend compartido con Netlify DB

- Definir el esquema (cuentas, créditos, abonos) con Drizzle sobre Netlify DB
  (Postgres administrado).
- Reemplazar el store local por llamadas a rutas de servidor (Nuxt server
  routes / Netlify Functions) para que los datos se compartan entre
  dispositivos y no dependan del navegador.
- La importación de Excel pasa a insertar/actualizar directamente en la base
  de datos en lugar de solo en memoria.

## Milestone 3 — Acceso de usuarios

- Autenticación (Netlify Identity o similar) para que solo el personal
  autorizado pueda ver y editar la cartera.
- Roles simples: quién puede solo consultar y quién puede registrar
  créditos/abonos.

## Milestone 4 — Sincronización real con Supabase

- Usar la conexión ya probada en Ajustes para sincronizar (subir/traer) los
  datos con las tablas de un proyecto Supabase del usuario, como alternativa
  o respaldo a Netlify DB.

## Milestone 5 — Reportes y alertas

- Reporte de antigüedad de saldos (aging report).
- Exportación de reportes en PDF.
- Recordatorios automáticos de cuentas próximas a vencer o vencidas.
