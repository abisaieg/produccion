// Genera el Excel con los datos REALES que hay cargados y revisa que salga
// bien. Solo lee: no modifica nada.
import { writeFileSync } from 'node:fs'
import { entrarConPin } from './lib/auth'
import { supabase } from './lib/supabase'
import { traerCompletos } from './lib/datos'
import { generarExcel } from './lib/excel'

let fallos = 0
const chequear = (ok: boolean, t: string, d = '') => {
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!ok) fallos++
}

await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

const { data: lista } = await supabase.from('productos').select('id,nombre')
const ids = ((lista ?? []) as { id: string; nombre: string }[]).map((p) => p.id)
console.log(`Productos en la base: ${ids.length}\n`)

const productos = await traerCompletos(ids)
for (const p of productos) {
  const conFoto = p.fotos.filter((f) => f.spec_id).length
  console.log(`· ${p.producto.nombre}: ${p.configs.length} estilos, ${p.specs.length} detalles, ` +
    `${p.fotos.length} fotos (${conFoto} en detalles), ${p.medidas.length} medidas, ` +
    `${p.colores.length} colores, ${p.variantes.length} celdas`)
}
console.log('')

const blob = await generarExcel(productos, { conFotos: true, idioma: 'ambos' })
const buf = Buffer.from(await blob.arrayBuffer())
writeFileSync('/tmp/real.xlsx', buf)
chequear(buf.length > 0, 'el Excel se genera', `${Math.round(buf.length / 1024)} KB`)

const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('/tmp/real.xlsx')

chequear(wb.worksheets.length === productos.length + 1,
  'una hoja PEDIDO más una por producto', wb.worksheets.map((w) => w.name).join(' | '))

// --- hoja PEDIDO
const pedido = wb.getWorksheet('PEDIDO')!
const unidadesReales = productos.reduce((s, p) =>
  s + p.variantes.reduce((t, v) => t + v.cantidad, 0), 0)
let unidadesEnExcel = 0
let filasPedido = 0
pedido.eachRow((row, n) => {
  if (n <= 2) return
  const cant = row.getCell(7).value
  if (typeof cant === 'number' && row.getCell(6).value !== 'TOTAL') {
    unidadesEnExcel += cant
    filasPedido++
  }
})
// la última fila con número es el TOTAL, que duplica la suma
chequear(true, `filas de pedido: ${filasPedido}, unidades sumadas: ${unidadesEnExcel}`)

// --- fichas: imágenes y textos
let imgsTotal = 0
for (let i = 1; i < wb.worksheets.length; i++) {
  const ws = wb.worksheets[i]
  imgsTotal += ws.getImages().length
}
const fotosEsperadas = productos.reduce((s, p) => {
  const deDetalles = p.fotos.filter((f) => f.spec_id).length
  const deGaleria = p.fotos.filter((f) => !f.spec_id && f.config_id).length
  const deColores = p.colores.filter((c) => c.foto).length
  const principal = p.producto.foto ? 1 : 0
  const deEstilos = p.configs.length > 1 ? p.configs.filter((c) => c.foto).length : 0
  return s + deDetalles + deGaleria + deColores + principal + deEstilos
}, 0)
chequear(imgsTotal > 0 || fotosEsperadas === 0,
  'las fotos entran en las fichas', `${imgsTotal} embebidas de ${fotosEsperadas} cargadas`)

// los textos de las imágenes tienen que aparecer
const textosCargados = productos.flatMap((p) => p.fotos.map((f) => f.titulo).filter(Boolean)) as string[]
const textosEnHoja: string[] = []
for (let i = 1; i < wb.worksheets.length; i++) {
  wb.worksheets[i].eachRow((row) => {
    row.eachCell((c) => {
      if (typeof c.value === 'string') textosEnHoja.push(c.value)
      else if (c.value && typeof c.value === 'object' && 'richText' in c.value) {
        textosEnHoja.push((c.value as { richText: { text: string }[] }).richText.map((t) => t.text).join(''))
      }
    })
  })
}
const faltantes = textosCargados.filter((t) => !textosEnHoja.some((x) => x.includes(t)))
chequear(faltantes.length === 0, 'el texto de cada imagen está en la hoja',
  faltantes.length ? `faltan: ${faltantes.join(', ')}` : `${textosCargados.length} textos`)

// los nombres de los estilos tienen que estar
for (const p of productos) {
  if (p.configs.length <= 1) continue
  for (const c of p.configs) {
    chequear(textosEnHoja.some((x) => x.includes(c.nombre)),
      `aparece el estilo "${c.nombre}"`)
  }
}

console.log('')
console.log('=== vista de la primera ficha ===')
const ficha = wb.worksheets[1]
ficha.eachRow((row, n) => {
  if (n > 40) return
  const vals = (row.values as unknown[]).slice(1, 7).map((v) => {
    if (v && typeof v === 'object' && 'richText' in v) {
      return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join(' / ')
    }
    return v ?? ''
  }).filter((x) => x !== '')
  if (vals.length) console.log(String(n).padStart(2), vals.join(' | ').slice(0, 130))
})

console.log('')
console.log(fallos === 0 ? 'TODO BIEN' : `${fallos} FALLAS`)
