// Cargar el pedido por porcentajes: ¿se calculan bien las unidades y salen
// los porcentajes en el Excel?
import { writeFileSync } from 'node:fs'
import { entrarConPin } from './lib/auth'
import { db, traerCompletos } from './lib/datos'
import { generarExcel } from './lib/excel'

let fallos = 0
const chequear = (ok: boolean, t: string, d = '') => {
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!ok) fallos++
}

await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

const { data: prod } = await db.crearProducto({ nombre: 'PRUEBA porcentajes' })
const pid = prod!.id as string
let [d] = await traerCompletos([pid])
const cfg = d.configs[0].id

// contenedor de 2000 unidades para este diseño
await db.actualizar('configuraciones', cfg, { total_unidades: 2000 })

// la regla del usuario: 45% Queen, 40% Twin, 15% King
const { data: meds } = await db.agregarVarias('medidas', [
  { producto_id: pid, config_id: cfg, nombre: 'Twin', porcentaje: 40, orden: 0 },
  { producto_id: pid, config_id: cfg, nombre: 'Queen', porcentaje: 45, orden: 1 },
  { producto_id: pid, config_id: cfg, nombre: 'King', porcentaje: 15, orden: 2 },
])
const { data: cols } = await db.agregarVarias('colores', [
  { producto_id: pid, config_id: cfg, nombre: 'Claro', orden: 0 },
  { producto_id: pid, config_id: cfg, nombre: 'Normal', orden: 1 },
  { producto_id: pid, config_id: cfg, nombre: 'Oscuro', orden: 2 },
  { producto_id: pid, config_id: cfg, nombre: 'Diferente', orden: 3 },
])
const medidas = meds as { id: string; nombre: string; porcentaje: number }[]
const colores = cols as { id: string; nombre: string }[]

// repartir cada medida en partes iguales entre los 4 colores
const filas = medidas.flatMap((m) => {
  const porColor = Number((m.porcentaje / colores.length).toFixed(3))
  return colores.map((c) => ({
    producto_id: pid, config_id: cfg, medida_id: m.id, color_id: c.id,
    porcentaje: porColor, cantidad: Math.round(2000 * porColor / 100),
  }))
})
await db.setVariasCeldas(filas)

;[d] = await traerCompletos([pid])
const cant = (mn: string, cn: string) => {
  const m = d.medidas.find((x) => x.nombre === mn)!
  const c = d.colores.find((x) => x.nombre === cn)!
  return d.variantes.find((v) => v.medida_id === m.id && v.color_id === c.id)
}

chequear(d.configs[0].total_unidades === 2000, 'el contenedor queda guardado',
  String(d.configs[0].total_unidades))

// Twin 40% de 2000 = 800; entre 4 colores = 200 cada uno
chequear(cant('Twin', 'Claro')?.cantidad === 200, 'Twin/Claro = 10% de 2000 = 200',
  String(cant('Twin', 'Claro')?.cantidad))
// Queen 45% = 900; /4 = 225
chequear(cant('Queen', 'Oscuro')?.cantidad === 225, 'Queen/Oscuro = 11,25% = 225',
  String(cant('Queen', 'Oscuro')?.cantidad))
// King 15% = 300; /4 = 75
chequear(cant('King', 'Diferente')?.cantidad === 75, 'King/Diferente = 3,75% = 75',
  String(cant('King', 'Diferente')?.cantidad))

const totalUnidades = d.variantes.reduce((s, v) => s + v.cantidad, 0)
chequear(totalUnidades === 2000, 'las 12 celdas suman el contenedor entero',
  String(totalUnidades))
const totalPct = d.variantes.reduce((s, v) => s + Number(v.porcentaje ?? 0), 0)
chequear(Math.abs(totalPct - 100) < 0.01, 'los porcentajes suman 100%',
  `${totalPct.toFixed(2)}%`)

// --- el Excel
const blob = await generarExcel([d], { conFotos: false, idioma: 'ambos' })
const buf = Buffer.from(await blob.arrayBuffer())
writeFileSync('/tmp/pct.xlsx', buf)
const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('/tmp/pct.xlsx')

const texto = (v: unknown): string => {
  if (v && typeof v === 'object' && 'richText' in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join(' ')
  }
  return String(v ?? '')
}

const pedido = wb.getWorksheet('PEDIDO')!
const cab = (pedido.getRow(2).values as unknown[]).map(texto)
chequear(cab.some((c) => c.includes('%')), 'la hoja PEDIDO tiene columna de porcentaje',
  cab.filter(Boolean).join(' | '))

const ficha = wb.worksheets[1]
let hayPctEnMatriz = false
let hayContenedor = false
ficha.eachRow((row) => {
  row.eachCell((c) => {
    const t = texto(c.value)
    if (t.includes('11.25%') || t.includes('11,25%')) hayPctEnMatriz = true
    if (t.includes('Contenedor')) hayContenedor = true
  })
})
chequear(hayContenedor, 'la ficha muestra el contenedor')
chequear(hayPctEnMatriz, 'la matriz muestra el % junto a las unidades')

console.log('\n--- matriz como sale en el Excel ---')
ficha.eachRow((row, n) => {
  const vals = (row.values as unknown[]).slice(1, 8).map(texto).filter((x) => x && x !== 'undefined')
  if (vals.length && n > 8) console.log('  ' + vals.join(' | ').replace(/\n/g, ' '))
})

await db.borrarProducto(pid)
console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLAS`)
if (fallos) throw new Error('fallas')
