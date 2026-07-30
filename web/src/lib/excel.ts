import type ExcelJS from 'exceljs'
import type { ProductoCompleto } from './tipos'
import { estadoInfo, ESTADO_EN } from './tipos'
import { traducir, type Idioma, type Traducciones } from './traducir'

const NEGRO = 'FF111111'
const GRIS = 'FFF4F4F5'
const BORDE = 'FFD4D4D8'
const TENUE = 'FF71717A'

const borde = {
  top: { style: 'thin' as const, color: { argb: BORDE } },
  left: { style: 'thin' as const, color: { argb: BORDE } },
  bottom: { style: 'thin' as const, color: { argb: BORDE } },
  right: { style: 'thin' as const, color: { argb: BORDE } },
}

export interface OpcionesExport {
  conFotos: boolean
  idioma: Idioma
}

// --------------------------------------------------------------- bilingüe

/** Rótulo fijo de la plantilla (no pasa por el traductor). */
function rotulo(es: string, en: string, idioma: Idioma) {
  if (idioma === 'es') return es
  if (idioma === 'en') return en
  return `${es} / ${en}`
}

/**
 * Valor cargado por el usuario. En modo "ambos" queda el español arriba y el
 * inglés abajo en cursiva gris, dentro de la misma celda.
 */
function valor(
  texto: string | null | undefined,
  tr: Traducciones,
  idioma: Idioma,
): ExcelJS.CellValue {
  const es = (texto ?? '').trim()
  if (!es) return ''
  const en = tr.get(es)
  if (idioma === 'es' || !en || en === es) return es
  if (idioma === 'en') return en
  return {
    richText: [
      { text: es },
      { text: `\n${en}`, font: { italic: true, color: { argb: TENUE }, size: 9 } },
    ],
  }
}

/** Versión en una sola línea, para celdas angostas de la hoja PEDIDO. */
function valorCorto(
  texto: string | null | undefined,
  tr: Traducciones,
  idioma: Idioma,
): string {
  const es = (texto ?? '').trim()
  if (!es) return ''
  const en = tr.get(es)
  if (idioma === 'es' || !en || en === es) return es
  if (idioma === 'en') return en
  return `${es} / ${en}`
}

/** Junta todo el texto libre que hay que mandar a traducir. */
function textosDe(productos: ProductoCompleto[]): string[] {
  const out: (string | null)[] = []
  for (const p of productos) {
    out.push(p.producto.nombre, p.producto.descripcion, p.producto.categoria)
    for (const s of p.specs) out.push(s.nombre, s.valor)
    for (const m of p.medidas) out.push(m.nombre, m.detalle)
    for (const c of p.colores) out.push(c.nombre)
    for (const f of p.fotos) out.push(f.titulo)
    for (const n of p.notas) out.push(n.texto)
    for (const v of p.variantes) out.push(v.notas)
  }
  return out.filter((x): x is string => !!x && x.trim().length > 0)
}

// ----------------------------------------------------------------- helpers

async function bajarImagen(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const tipo = res.headers.get('content-type') ?? ''
    const ext = tipo.includes('png') ? 'png' : tipo.includes('gif') ? 'gif'
      : tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpeg' : null
    if (!ext) return null // webp/heic: Excel no los soporta
    return { buffer: await res.arrayBuffer(), extension: ext as 'png' | 'gif' | 'jpeg' }
  } catch {
    return null
  }
}

function nombreHoja(texto: string, indice: number) {
  const limpio = texto.replace(/[\\/*?:[\]]/g, ' ').trim() || 'Producto'
  return `${indice}. ${limpio}`.slice(0, 31)
}

function precioDe(p: ProductoCompleto, medidaId: string, colorId: string): number | null {
  const v = p.variantes.find((x) => x.medida_id === medidaId && x.color_id === colorId)
  if (v?.precio_unit != null) return Number(v.precio_unit)
  const m = p.medidas.find((x) => x.id === medidaId)
  return m?.precio_unit != null ? Number(m.precio_unit) : null
}

function cantidadDe(p: ProductoCompleto, medidaId: string, colorId: string) {
  return p.variantes.find((x) => x.medida_id === medidaId && x.color_id === colorId)?.cantidad ?? 0
}

// ---------------------------------------------------------------------------

export async function generarExcel(
  productos: ProductoCompleto[],
  op: OpcionesExport,
): Promise<Blob> {
  const tr: Traducciones = op.idioma === 'es'
    ? new Map()
    : await traducir(textosDe(productos))

  // ExcelJS pesa ~1 MB: se carga recién cuando hace falta exportar
  const { default: Excel } = await import('exceljs')
  const wb = new Excel.Workbook()
  wb.creator = 'Producción'
  wb.created = new Date()

  hojaPedido(wb, productos, tr, op.idioma)
  for (let i = 0; i < productos.length; i++) {
    await hojaProducto(wb, productos[i], i + 1, op, tr)
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ------------------------------------------------------- hoja 1: el pedido
function hojaPedido(
  wb: ExcelJS.Workbook,
  productos: ProductoCompleto[],
  tr: Traducciones,
  idioma: Idioma,
) {
  const ws = wb.addWorksheet('PEDIDO', { views: [{ state: 'frozen', ySplit: 2 }] })
  ws.columns = [
    { width: 30 }, { width: 14 }, { width: 20 }, { width: 22 },
    { width: 20 }, { width: 12 }, { width: 14 }, { width: 14 },
  ]

  const titulo = ws.getCell('A1')
  titulo.value = rotulo('PEDIDO', 'PURCHASE ORDER', idioma)
  titulo.font = { bold: true, size: 14, color: { argb: NEGRO } }
  ws.mergeCells('A1:H1')
  ws.getRow(1).height = 26

  const filaCab = ws.getRow(2)
  filaCab.values = [
    rotulo('Producto', 'Product', idioma),
    rotulo('Código', 'Code', idioma),
    rotulo('Medida', 'Size', idioma),
    rotulo('Detalle', 'Spec', idioma),
    rotulo('Color', 'Color', idioma),
    rotulo('Cantidad', 'Qty', idioma),
    rotulo('Precio U.', 'Unit price', idioma),
    rotulo('Subtotal', 'Subtotal', idioma),
  ]
  filaCab.height = 24
  filaCab.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = borde
  })

  let fila = 3
  let totalUnidades = 0
  let totalMonto = 0
  let hayPrecios = false

  for (const p of productos) {
    const inicio = fila
    for (const m of p.medidas) {
      for (const c of p.colores) {
        const cant = cantidadDe(p, m.id, c.id)
        if (cant <= 0) continue
        const precio = precioDe(p, m.id, c.id)
        if (precio != null) hayPrecios = true

        const r = ws.getRow(fila)
        r.values = [
          valorCorto(p.producto.nombre, tr, idioma),
          p.producto.codigo ?? '',
          valorCorto(m.nombre, tr, idioma),
          valorCorto(m.detalle, tr, idioma),
          valorCorto(c.nombre, tr, idioma),
          cant,
          precio ?? '',
          precio != null ? precio * cant : '',
        ]
        r.eachCell((cel, i) => {
          cel.border = borde
          cel.alignment = i >= 6
            ? { horizontal: 'right', vertical: 'middle' }
            : { vertical: 'middle', wrapText: true }
        })
        r.getCell(6).numFmt = '#,##0'
        r.getCell(7).numFmt = '#,##0.0000'
        r.getCell(8).numFmt = '#,##0.00'

        totalUnidades += cant
        if (precio != null) totalMonto += precio * cant
        fila++
      }
    }
    if (fila === inicio) {
      const r = ws.getRow(fila)
      r.values = [valorCorto(p.producto.nombre, tr, idioma), p.producto.codigo ?? '', '—', '', '', 0, '', '']
      r.eachCell((cel) => { cel.border = borde })
      fila++
    }
  }

  const rTotal = ws.getRow(fila + 1)
  rTotal.getCell(5).value = 'TOTAL'
  rTotal.getCell(6).value = totalUnidades
  rTotal.getCell(6).numFmt = '#,##0'
  if (hayPrecios) {
    rTotal.getCell(8).value = totalMonto
    rTotal.getCell(8).numFmt = '#,##0.00'
  }
  for (const i of [5, 6, 7, 8]) {
    const c = rTotal.getCell(i)
    c.font = { bold: true, size: 11 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    c.border = borde
    c.alignment = { horizontal: 'right', vertical: 'middle' }
  }
  rTotal.height = 22

  if (hayPrecios) {
    const moneda = productos[0]?.producto.moneda ?? 'USD'
    const nota = ws.getCell(`A${fila + 3}`)
    nota.value = rotulo(
      `Precios expresados en ${moneda}`,
      `Prices in ${moneda}`,
      idioma,
    )
    nota.font = { italic: true, size: 9, color: { argb: TENUE } }
  }
}

// -------------------------------------------------- hoja por producto (ficha)
async function hojaProducto(
  wb: ExcelJS.Workbook,
  p: ProductoCompleto,
  indice: number,
  op: OpcionesExport,
  tr: Traducciones,
) {
  const { idioma, conFotos } = op
  const ws = wb.addWorksheet(nombreHoja(p.producto.nombre, indice))
  ws.columns = [
    { width: 26 }, { width: 46 }, { width: 18 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ]

  let fila = 1
  const seccion = (es: string, en: string) => {
    const r = ws.getRow(fila)
    r.getCell(1).value = rotulo(es, en, idioma)
    r.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    for (let i = 1; i <= 8; i++) {
      r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } }
    }
    r.height = 20
    fila += 1
  }

  // --- encabezado
  const rTit = ws.getRow(fila)
  rTit.getCell(1).value = valor(p.producto.nombre, tr, idioma)
  rTit.getCell(1).font = { bold: true, size: 16, color: { argb: NEGRO } }
  rTit.getCell(1).alignment = { vertical: 'middle', wrapText: true }
  rTit.height = idioma === 'ambos' ? 40 : 30
  ws.mergeCells(fila, 1, fila, 5)
  fila += 1

  const est = p.producto.estado
  const datos: [string, string, ExcelJS.CellValue][] = [
    ['Código', 'Code', p.producto.codigo ?? '—'],
    ['Proveedor', 'Supplier', p.producto.proveedor ?? '—'],
    ['Categoría', 'Category', valor(p.producto.categoria, tr, idioma) || '—'],
    ['Estado', 'Status', rotulo(estadoInfo(est).texto, ESTADO_EN[est] ?? est, idioma)],
    ['Moneda', 'Currency', p.producto.moneda],
  ]
  for (const [es, en, v] of datos) {
    const r = ws.getRow(fila)
    r.getCell(1).value = rotulo(es, en, idioma)
    r.getCell(1).font = { bold: true, size: 10, color: { argb: TENUE } }
    r.getCell(2).value = v
    r.getCell(2).font = { size: 10 }
    r.getCell(2).alignment = { vertical: 'middle', wrapText: true }
    fila += 1
  }

  if (p.producto.descripcion) {
    const r = ws.getRow(fila)
    r.getCell(1).value = rotulo('Descripción', 'Description', idioma)
    r.getCell(1).font = { bold: true, size: 10, color: { argb: TENUE } }
    r.getCell(2).value = valor(p.producto.descripcion, tr, idioma)
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    ws.mergeCells(fila, 2, fila, 5)
    const largo = p.producto.descripcion.length * (idioma === 'ambos' ? 2 : 1)
    r.height = Math.min(110, 18 + largo / 3)
    fila += 1
  }

  if (conFotos && p.producto.foto) {
    const img = await bajarImagen(p.producto.foto)
    if (img) {
      const id = wb.addImage(img)
      ws.addImage(id, { tl: { col: 5.2, row: 0.2 }, ext: { width: 190, height: 190 } })
    }
  }
  fila += 1

  // --- especificaciones
  if (p.specs.length) {
    seccion('ESPECIFICACIONES', 'SPECIFICATIONS')
    const cab = ws.getRow(fila)
    cab.values = [
      rotulo('Detalle', 'Item', idioma),
      rotulo('Valor', 'Value', idioma),
      conFotos ? rotulo('Referencia', 'Reference', idioma) : '',
    ]
    cab.eachCell((c) => {
      c.font = { bold: true, size: 10 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      c.border = borde
    })
    fila += 1

    for (const s of p.specs) {
      const r = ws.getRow(fila)
      r.getCell(1).value = valor(s.nombre, tr, idioma)
      r.getCell(1).font = { bold: true, size: 10 }
      r.getCell(1).alignment = { vertical: 'middle', wrapText: true }
      r.getCell(1).border = borde
      r.getCell(2).value = valor(s.valor, tr, idioma)
      r.getCell(2).alignment = { vertical: 'middle', wrapText: true }
      r.getCell(2).border = borde
      r.getCell(3).border = borde

      let alto = idioma === 'ambos' ? 34 : 24
      if (conFotos && s.foto) {
        const img = await bajarImagen(s.foto)
        if (img) {
          const id = wb.addImage(img)
          ws.addImage(id, {
            tl: { col: 2.1, row: fila - 1 + 0.1 },
            ext: { width: 96, height: 96 },
          })
          alto = 78
        }
      }
      const largo = (s.valor?.length ?? 0) * (idioma === 'ambos' ? 2 : 1)
      r.height = Math.max(alto, Math.min(110, 18 + largo / 2.5))
      fila += 1
    }
    fila += 1
  }

  // --- matriz medidas x colores
  if (p.medidas.length && p.colores.length) {
    seccion('CANTIDADES POR MEDIDA Y COLOR', 'QUANTITIES BY SIZE AND COLOR')

    const cab = ws.getRow(fila)
    cab.getCell(1).value = rotulo('Medida', 'Size', idioma)
    p.colores.forEach((c, i) => { cab.getCell(2 + i).value = valorCorto(c.nombre, tr, idioma) })
    cab.getCell(2 + p.colores.length).value = 'Total'
    cab.height = 26
    for (let i = 1; i <= p.colores.length + 2; i++) {
      const c = cab.getCell(i)
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } }
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      c.border = borde
    }
    fila += 1

    const totalPorColor = new Array(p.colores.length).fill(0)
    let totalGeneral = 0

    for (const m of p.medidas) {
      const r = ws.getRow(fila)
      const nombreMedida = m.detalle
        ? `${valorCorto(m.nombre, tr, idioma)} — ${valorCorto(m.detalle, tr, idioma)}`
        : valorCorto(m.nombre, tr, idioma)
      r.getCell(1).value = nombreMedida
      r.getCell(1).font = { bold: true, size: 10 }
      r.getCell(1).alignment = { vertical: 'middle', wrapText: true }
      r.getCell(1).border = borde

      let totalFila = 0
      p.colores.forEach((c, i) => {
        const cant = cantidadDe(p, m.id, c.id)
        const cel = r.getCell(2 + i)
        cel.value = cant || ''
        cel.numFmt = '#,##0'
        cel.alignment = { horizontal: 'center', vertical: 'middle' }
        cel.border = borde
        totalFila += cant
        totalPorColor[i] += cant
      })

      const celTotal = r.getCell(2 + p.colores.length)
      celTotal.value = totalFila
      celTotal.numFmt = '#,##0'
      celTotal.font = { bold: true }
      celTotal.alignment = { horizontal: 'center', vertical: 'middle' }
      celTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      celTotal.border = borde
      totalGeneral += totalFila
      r.height = 22
      fila += 1
    }

    const rTot = ws.getRow(fila)
    rTot.getCell(1).value = 'Total'
    totalPorColor.forEach((t, i) => {
      const c = rTot.getCell(2 + i)
      c.value = t
      c.numFmt = '#,##0'
    })
    rTot.getCell(2 + p.colores.length).value = totalGeneral
    rTot.getCell(2 + p.colores.length).numFmt = '#,##0'
    for (let i = 1; i <= p.colores.length + 2; i++) {
      const c = rTot.getCell(i)
      c.font = { bold: true, size: 10 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      c.border = borde
      if (i > 1) c.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    rTot.height = 20
    fila += 2

    const conPrecio = p.medidas.filter((m) => m.precio_unit != null)
    if (conPrecio.length) {
      seccion(`PRECIOS (${p.producto.moneda})`, `PRICES (${p.producto.moneda})`)
      const cab2 = ws.getRow(fila)
      cab2.values = [
        rotulo('Medida', 'Size', idioma),
        rotulo('Precio unitario', 'Unit price', idioma),
        rotulo('Cantidad', 'Qty', idioma),
        rotulo('Subtotal', 'Subtotal', idioma),
      ]
      cab2.eachCell((c) => {
        c.font = { bold: true, size: 10 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
        c.border = borde
      })
      fila += 1

      let acumulado = 0
      for (const m of conPrecio) {
        const cant = p.colores.reduce((s, c) => s + cantidadDe(p, m.id, c.id), 0)
        const sub = Number(m.precio_unit) * cant
        acumulado += sub
        const r = ws.getRow(fila)
        r.values = [valorCorto(m.nombre, tr, idioma), Number(m.precio_unit), cant, sub]
        r.getCell(2).numFmt = '#,##0.0000'
        r.getCell(3).numFmt = '#,##0'
        r.getCell(4).numFmt = '#,##0.00'
        r.eachCell((c) => { c.border = borde })
        fila += 1
      }
      const rFin = ws.getRow(fila)
      rFin.getCell(3).value = 'TOTAL'
      rFin.getCell(4).value = acumulado
      rFin.getCell(4).numFmt = '#,##0.00'
      rFin.getCell(3).font = { bold: true }
      rFin.getCell(4).font = { bold: true }
      fila += 2
    }
  }

  // --- galería de fotos de ejemplo
  if (conFotos && p.fotos.length) {
    seccion('FOTOS DE REFERENCIA', 'REFERENCE PHOTOS')
    const filaBase = fila
    let col = 0
    for (const f of p.fotos) {
      const img = await bajarImagen(f.url)
      if (!img) continue
      const id = wb.addImage(img)
      const filaImg = filaBase + Math.floor(col / 4) * 10
      ws.addImage(id, {
        tl: { col: (col % 4) * 2 + 0.1, row: filaImg - 1 + 0.1 },
        ext: { width: 175, height: 175 },
      })
      if (f.titulo) {
        const rt = ws.getRow(filaImg + 8)
        const cel = rt.getCell((col % 4) * 2 + 1)
        cel.value = valor(f.titulo, tr, idioma)
        cel.font = { size: 9, color: { argb: TENUE } }
        cel.alignment = { wrapText: true, vertical: 'top' }
        rt.height = idioma === 'ambos' ? 28 : 16
      }
      col += 1
    }
    const filasUsadas = Math.ceil(col / 4) * 10
    for (let i = 0; i < filasUsadas; i++) {
      const r = ws.getRow(filaBase + i)
      if (!r.height) r.height = 20
    }
    fila = filaBase + filasUsadas + 1
  }

  // --- notas
  if (p.notas.length) {
    seccion('NOTAS', 'NOTES')
    for (const n of p.notas) {
      const r = ws.getRow(fila)
      r.getCell(1).value = new Date(n.created_at).toLocaleDateString('es-AR')
      r.getCell(1).font = { size: 9, color: { argb: TENUE } }
      r.getCell(1).alignment = { vertical: 'top' }
      r.getCell(2).value = valor(n.texto, tr, idioma)
      r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
      ws.mergeCells(fila, 2, fila, 6)
      const largo = n.texto.length * (idioma === 'ambos' ? 2 : 1)
      r.height = Math.min(90, 18 + largo / 5)
      fila += 1
    }
  }
}

// --------------------------------------------------------------- descarga

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function nombreArchivo(productos: ProductoCompleto[]) {
  const hoy = new Date().toISOString().slice(0, 10)
  if (productos.length === 1) {
    const limpio = productos[0].producto.nombre.replace(/[^\w\sáéíóúñ-]/gi, '').trim()
    return `${limpio || 'producto'} - ${hoy}.xlsx`
  }
  return `Pedido ${productos.length} productos - ${hoy}.xlsx`
}
