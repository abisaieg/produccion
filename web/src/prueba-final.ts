// Revisión completa del Excel con los datos reales, en los tres idiomas.
import { writeFileSync } from 'node:fs'
import { entrarConPin } from './lib/auth'
import { supabase } from './lib/supabase'
import { traerCompletos } from './lib/datos'
import { generarExcel, imagenesQueFaltaron } from './lib/excel'
import type { Idioma } from './lib/traducir'

let fallos = 0
const ok = (b: boolean, t: string, d = '') => {
  console.log(`${b ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!b) fallos++
}

await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)
const { data } = await supabase.from('productos').select('id')
const ps = await traerCompletos((data as { id: string }[]).map((p) => p.id))

// cuántas imágenes debería llevar el archivo
const esperadas = ps.reduce((s, p) =>
  s + (p.producto.foto ? 1 : 0)
    + p.fotos.length
    + p.specs.filter((e) => e.foto).length
    + p.colores.filter((c) => c.foto).length
    + (p.configs.length > 1 ? p.configs.filter((c) => c.foto).length : 0), 0)
console.log(`Imágenes cargadas en el producto: ${esperadas}\n`)

const ExcelJS = (await import('exceljs')).default
const txt = (v: unknown): string => {
  if (v && typeof v === 'object' && 'richText' in v)
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join(' ')
  return String(v ?? '')
}

for (const idioma of ['ambos', 'en', 'es'] as Idioma[]) {
  const blob = await generarExcel(ps, { conFotos: true, idioma })
  const buf = Buffer.from(await blob.arrayBuffer())
  writeFileSync(`/tmp/final-${idioma}.xlsx`, buf)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())

  const imgs = wb.worksheets.slice(1).reduce((s, w) => s + w.getImages().length, 0)
  const faltaron = imagenesQueFaltaron().length
  console.log(`--- idioma "${idioma}" · ${Math.round(buf.length / 1024)} KB ---`)
  ok(imgs === esperadas, `entran las ${esperadas} imágenes`, `${imgs} embebidas, ${faltaron} omitidas`)
  ok(wb.worksheets.length === ps.length + 1, 'PEDIDO + una hoja por producto')

  // la hoja PEDIDO no debe traer columnas de unidades si va por porcentaje
  const cab = (wb.getWorksheet('PEDIDO')!.getRow(2).values as unknown[]).map(txt).filter(Boolean)
  ok(!cab.some((c) => /Cantidad|Qty/.test(c)), 'sin columna de unidades', cab.join(' | '))
  ok(cab.some((c) => c.includes('%')), 'con columna de porcentaje')

  // filas del pedido
  let filas = 0
  wb.getWorksheet('PEDIDO')!.eachRow((r, n) => { if (n > 2 && txt(r.getCell(1).value)) filas++ })
  const celdasConPct = ps.reduce((s, p) => s + p.variantes.filter((v) => v.porcentaje != null).length, 0)
  ok(filas >= celdasConPct, `lista las ${celdasConPct} combinaciones`, `${filas} filas`)

  // el idioma se respeta
  const todo: string[] = []
  wb.worksheets.forEach((w) => w.eachRow((r) => r.eachCell((c) => todo.push(txt(c.value)))))
  const junto = todo.join(' ')
  if (idioma === 'en') {
    ok(!junto.includes('Medida /'), 'en inglés no repite el español')
    ok(junto.includes('Size'), 'usa los rótulos en inglés')
    ok(junto.includes('Pearl Gray') || junto.includes('Deep Burgundy'),
      'traduce los nombres de color')
  }
  if (idioma === 'es') {
    ok(!junto.includes('Pearl Gray'), 'en español no aparecen traducciones')
  }
  if (idioma === 'ambos') {
    ok(junto.includes('Medida / Size'), 'muestra los dos idiomas')
  }
  console.log('')
}

console.log(fallos === 0 ? 'TODO BIEN' : `${fallos} FALLAS`)
if (fallos) throw new Error('fallas')
