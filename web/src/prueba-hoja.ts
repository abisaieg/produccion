// El Excel nuevo: una sola hoja, una fila por medida, sin datos vacíos.
import { entrarConPin } from './lib/auth'
import { db, traerCompletos } from './lib/datos'
import { generarExcel } from './lib/excel'

let fallos = 0
const ok = (b: boolean, t: string, d = '') => {
  console.log(`${b ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!b) fallos++
}
await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

const { data: prod } = await db.crearProducto({ nombre: 'PRUEBA hoja unica' })
const pid = prod!.id as string
let [d] = await traerCompletos([pid])
const cfg = d.configs[0].id

await db.agregar('especificaciones', {
  producto_id: pid, config_id: null, nombre: 'Configuración general',
  valor: '16 colores, 45% Queen', orden: 0,
})
await db.agregar('notas', { producto_id: pid, texto: 'una nota de prueba' })
const { data: meds } = await db.agregarVarias('medidas', [
  { producto_id: pid, config_id: cfg, nombre: 'Twin', porcentaje: 40, orden: 0 },
  { producto_id: pid, config_id: cfg, nombre: 'Queen', porcentaje: 60, orden: 1 },
])
const { data: cols } = await db.agregarVarias('colores', [
  { producto_id: pid, config_id: cfg, nombre: 'Beige', orden: 0 },
  { producto_id: pid, config_id: cfg, nombre: 'Gris', orden: 1 },
])
const filas = (meds as {id:string;porcentaje:number}[]).flatMap((m) =>
  (cols as {id:string}[]).map((c) => ({
    producto_id: pid, config_id: cfg, medida_id: m.id, color_id: c.id,
    porcentaje: m.porcentaje / 2, cantidad: 0,
  })))
await db.setVariasCeldas(filas)

;[d] = await traerCompletos([pid])
const blob = await generarExcel([d], { conFotos: false, idioma: 'es' })
const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
await wb.xlsx.load(await blob.arrayBuffer())

ok(wb.worksheets.length === 1, 'una sola hoja', wb.worksheets.map((w) => w.name).join(', '))

const ws = wb.worksheets[0]
const lineas: string[] = []
ws.eachRow((r) => {
  const v = (r.values as unknown[]).slice(1)
    .map((x) => typeof x === 'number' ? `${Math.round(x * 10000) / 100}%` : String(x ?? ''))
    .filter((x) => x && x !== 'undefined')
  if (v.length) lineas.push(v.join(' | '))
})
const todo = lineas.join('\n')

ok(todo.includes('DETALLES GENERALES'), 'muestra los detalles generales')
ok(todo.includes('16 colores, 45% Queen'), 'con su texto')
ok(todo.includes('NOTAS') && todo.includes('una nota de prueba'), 'muestra las notas')
ok(!/Estado|Moneda|Status|Currency/.test(todo), 'sin los datos vacíos del producto')

// una fila por medida, no una por combinación
const filasTwin = lineas.filter((l) => l.startsWith('Twin'))
ok(filasTwin.length === 1, 'una sola fila para Twin', `${filasTwin.length}`)
ok(filasTwin[0]?.split('|').length === 4, 'con una columna por color más el total',
  filasTwin[0])

console.log('\n--- la hoja entera ---')
lineas.forEach((l) => console.log('  ' + l.slice(0, 110)))

await db.borrarProducto(pid)
console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLAS`)
if (fallos) throw new Error('fallas')
