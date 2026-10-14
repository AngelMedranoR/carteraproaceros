import type { Cuenta } from '~/types'

export function useMonthlySeries(cuentas: Cuenta[], meses = 6) {
  const ahora = new Date()
  const claves: string[] = []
  const etiquetas: string[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    claves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    etiquetas.push(new Intl.DateTimeFormat('es-VE', { month: 'short' }).format(d))
  }

  const creditosPorMes = new Map(claves.map((k) => [k, 0]))
  const abonosPorMes = new Map(claves.map((k) => [k, 0]))

  cuentas.forEach((cuenta) => {
    cuenta.creditos.forEach((c) => {
      if (!c.fecha) return
      const clave = c.fecha.slice(0, 7)
      if (creditosPorMes.has(clave)) creditosPorMes.set(clave, (creditosPorMes.get(clave) || 0) + (c.montoDivisas || 0))
    })
    cuenta.abonos.forEach((a) => {
      if (!a.fecha) return
      const clave = a.fecha.slice(0, 7)
      if (abonosPorMes.has(clave)) abonosPorMes.set(clave, (abonosPorMes.get(clave) || 0) + (a.montoDivisas || 0))
    })
  })

  return {
    labels: etiquetas,
    creditos: claves.map((k) => Number((creditosPorMes.get(k) || 0).toFixed(2))),
    abonos: claves.map((k) => Number((abonosPorMes.get(k) || 0).toFixed(2))),
  }
}
