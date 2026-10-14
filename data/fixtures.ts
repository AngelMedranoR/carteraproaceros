import type { Cuenta } from '~/types'

let seq = 0
function id(prefix: string) {
  seq += 1
  return `${prefix}-${seq.toString(36)}`
}

function credito(fecha: string, numeroFactura: string, montoDivisas: number, montoBolivares: number | null = null) {
  return { id: id('cr'), fecha, numeroFactura, montoDivisas, montoBolivares }
}

function abono(fecha: string, montoDivisas: number, comentario: string, montoBolivares: number | null = null) {
  return { id: id('ab'), fecha, montoDivisas, comentario, montoBolivares }
}

export function crearDatosDemo(): Cuenta[] {
  const clientes: Cuenta[] = [
    {
      id: id('cli'),
      nombre: 'Ferretería San Rafael',
      tipo: 'cliente',
      creditos: [
        credito('2026-05-12', '31022', 2189.47, 1834920.5),
        credito('2026-06-03', '31198', 1547.9, 1298640.0),
        credito('2026-07-21', '31460', 3062.18, 2571430.9),
        credito('2026-08-14', '31589', 980.33),
      ],
      abonos: [
        abono('2026-06-10', 1500, 'Transferencia bolívares'),
        abono('2026-07-02', 800, 'Zelle'),
        abono('2026-08-01', 1200.5, 'Pago móvil + efectivo divisas'),
      ],
    },
    {
      id: id('cli'),
      nombre: 'Construcciones Delgado C.A.',
      tipo: 'cliente',
      creditos: [
        credito('2026-04-02', '30554', 4890.6),
        credito('2026-05-19', '30877', 2201.15),
        credito('2026-06-28', '31255', 3475.0),
      ],
      abonos: [
        abono('2026-04-20', 2000, 'Binance'),
        abono('2026-05-25', 3000, 'Transferencia bolívares'),
        abono('2026-07-05', 2600.75, 'Efectivo divisas'),
        abono('2026-08-02', 2966, 'Zelle — saldo restante nota 30877'),
      ],
    },
    {
      id: id('cli'),
      nombre: 'Taller Mecánico Bolívar',
      tipo: 'cliente',
      creditos: [credito('2026-08-30', '31712', 612.4), credito('2026-09-05', '31780', 340.9)],
      abonos: [abono('2026-09-08', 400, 'Pago móvil')],
    },
    {
      id: id('cli'),
      nombre: 'Distribuidora Los Cardones',
      tipo: 'cliente',
      creditos: [
        credito('2026-02-11', '29812', 1685.2),
        credito('2026-03-04', '30015', 990.44),
        credito('2026-03-29', '30201', 2140.0),
      ],
      abonos: [
        abono('2026-02-28', 1685.2, 'Transferencia — factura 29812 saldada'),
        abono('2026-04-02', 990.44, 'Zelle — factura 30015 saldada'),
        abono('2026-04-30', 2140, 'Binance — factura 30201 saldada'),
      ],
    },
    {
      id: id('cli'),
      nombre: 'Inversiones Guacamaya',
      tipo: 'cliente',
      creditos: [credito('2026-07-09', '31401', 1274.65), credito('2026-08-02', '31548', 856.3)],
      abonos: [abono('2026-08-05', 300, 'Abono parcial — transferencia')],
    },
    {
      id: id('cli'),
      nombre: 'Corporación Vialpa',
      tipo: 'cliente',
      creditos: [
        credito('2026-06-15', '31150', 5420.9),
        credito('2026-07-30', '31510', 2870.0),
        credito('2026-08-22', '31655', 1140.75),
      ],
      abonos: [
        abono('2026-07-01', 3000, 'Transferencia bolívares'),
        abono('2026-08-01', 2500, 'Zelle'),
      ],
    },
  ]

  const proveedores: Cuenta[] = [
    {
      id: id('prov'),
      nombre: 'Aceros del Caribe',
      tipo: 'proveedor',
      creditos: [
        credito('2026-05-06', 'F-22014', 3210.5),
        credito('2026-06-18', 'F-22197', 2870.9),
        credito('2026-08-01', 'F-22450', 1690.0),
      ],
      abonos: [
        abono('2026-06-01', 2000, 'Pago proveedor — transferencia'),
        abono('2026-07-15', 1800, 'Zelle proveedor'),
      ],
    },
    {
      id: id('prov'),
      nombre: 'Distribuidora Metálica Andina',
      tipo: 'proveedor',
      creditos: [credito('2026-07-11', 'DMA-884', 1420.75), credito('2026-08-19', 'DMA-921', 990.2)],
      abonos: [abono('2026-08-25', 600, 'Abono parcial')],
    },
    {
      id: id('prov'),
      nombre: 'Perfilados Orinoco',
      tipo: 'proveedor',
      creditos: [
        credito('2026-03-14', 'PO-1187', 5680.0),
        credito('2026-04-22', 'PO-1256', 2140.35),
      ],
      abonos: [
        abono('2026-04-01', 3000, 'Transferencia'),
        abono('2026-05-10', 2680, 'Zelle proveedor'),
        abono('2026-06-02', 2140.35, 'Saldo nota PO-1256'),
      ],
    },
    {
      id: id('prov'),
      nombre: 'Ferretotal Industrial',
      tipo: 'proveedor',
      creditos: [credito('2026-08-28', 'FT-3390', 780.6), credito('2026-09-03', 'FT-3412', 445.9)],
      abonos: [],
    },
    {
      id: id('prov'),
      nombre: 'Recubrimientos Yaracuy',
      tipo: 'proveedor',
      creditos: [credito('2026-06-20', 'RY-552', 1980.4), credito('2026-07-27', 'RY-601', 1105.15)],
      abonos: [abono('2026-07-01', 1980.4, 'Pago factura RY-552 completo')],
    },
    {
      id: id('prov'),
      nombre: 'Cauchos y Repuestos El Tigre',
      tipo: 'proveedor',
      creditos: [credito('2026-08-05', 'ET-7710', 630.0)],
      abonos: [abono('2026-08-20', 630, 'Pago móvil — cancelado')],
    },
  ]

  return [...clientes, ...proveedores]
}
