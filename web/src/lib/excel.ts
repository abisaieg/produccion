import type ExcelJS from 'exceljs'
import type { Configuracion, ProductoCompleto } from './tipos'
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

/** Versión en una sola línea, para celdas angostas. */
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
    for (const c of p.configs) out.push(c.nombre, c.descripcion)
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

/** Hijos que cuelgan de una configuración. */
const de = <T extends { config_id: string | null }>(lista: T[], cid: string) =>
  lista.filter((x) => x.config_id === cid)

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

/** Cuando el producto tiene un solo estilo, no vale la pena nombrarlo. */
function mostrarVersiones(p: ProductoCompleto) {
  return p.configs.length > 1
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
    { width: 28 }, { width: 20 }, { width: 13 }, { width: 18 },
    { width: 20 }, { width: 18 }, { width: 11 }, { width: 13 }, { width: 13 },
  ]

  const titulo = ws.getCell('A1')
  titulo.value = rotulo('PEDIDO', 'PURCHASE ORDER', idioma)
  titulo.font = { bold: true, size: 14, color: { argb: NEGRO } }
  ws.mergeCells('A1:I1')
  ws.getRow(1).height = 26

  const filaCab = ws.getRow(2)
  filaCab.values = [
    rotulo('Producto', 'Product', idioma),
    rotulo('Estilo', 'Style', idioma),
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
    const conVersiones = mostrarVersiones(p)

    for (const cfg of p.configs) {
      for (const m of de(p.medidas, cfg.id)) {
        for (const c of de(p.colores, cfg.id)) {
          const cant = cantidadDe(p, m.id, c.id)
          if (cant <= 0) continue
          const precio = precioDe(p, m.id, c.id)
          if (precio != null) hayPrecios = true

          const r = ws.getRow(fila)
          r.values = [
            valorCorto(p.producto.nombre, tr, idioma),
            conVersiones ? valorCorto(cfg.nombre, tr, idioma) : '',
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
            cel.alignment = i >= 7
              ? { horizontal: 'right', vertical: 'middle' }
              : { vertical: 'middle', wrapText: true }
          })
          r.getCell(7).numFmt = '#,##0'
          r.getCell(8).numFmt = '#,##0.0000'
          r.getCell(9).numFmt = '#,##0.00'

          totalUnidades += cant
          if (precio != null) totalMonto += precio * cant
          fila++
        }
      }
    }

    // el producto todavía no tiene cantidades: igual queda anotado
    if (fila === inicio) {
      const r = ws.getRow(fila)
      r.values = [
        valorCorto(p.producto.nombre, tr, idioma), '', p.producto.codigo ?? '',
        '—', '', '', 0, '', '',
      ]
      r.eachCell((cel) => { cel.border = borde })
      fila++
    }
  }

  const rTotal = ws.getRow(fila + 1)
  rTotal.getCell(6).value = 'TOTAL'
  rTotal.getCell(7).value = totalUnidades
  rTotal.getCell(7).numFmt = '#,##0'
  if (hayPrecios) {
    rTotal.getCell(9).value = totalMonto
    rTotal.getCell(9).numFmt = '#,##0.00'
  }
  for (const i of [6, 7, 8, 9]) {
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
    nota.value = rotulo(`Precios expresados en ${moneda}`, `Prices in ${moneda}`, idioma)
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

  const ctx = { ws, wb, tr, idioma, conFotos, fila: 1 }

  // las imágenes que cuelgan de cada detalle, para mostrarlas con su texto
  const fotosPorSpec = new Map<string, { url: string; titulo: string | null }[]>()
  for (const f of p.fotos) {
    if (!f.spec_id) continue
    const lista = fotosPorSpec.get(f.spec_id) ?? []
    lista.push({ url: f.url, titulo: f.titulo })
    fotosPorSpec.set(f.spec_id, lista)
  }

  // --- encabezado del producto
  const rTit = ws.getRow(ctx.fila)
  rTit.getCell(1).value = valor(p.producto.nombre, tr, idioma)
  rTit.getCell(1).font = { bold: true, size: 16, color: { argb: NEGRO } }
  rTit.getCell(1).alignment = { vertical: 'middle', wrapText: true }
  rTit.height = idioma === 'ambos' ? 40 : 30
  ws.mergeCells(ctx.fila, 1, ctx.fila, 5)
  ctx.fila += 1

  const est = p.producto.estado
  const datos: [string, string, ExcelJS.CellValue][] = [
    ['Código', 'Code', p.producto.codigo ?? '—'],
    ['Proveedor', 'Supplier', p.producto.proveedor ?? '—'],
    ['Categoría', 'Category', valor(p.producto.categoria, tr, idioma) || '—'],
    ['Estado', 'Status', rotulo(estadoInfo(est).texto, ESTADO_EN[est] ?? est, idioma)],
    ['Moneda', 'Currency', p.producto.moneda],
  ]
  for (const [es, en, v] of datos) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = rotulo(es, en, idioma)
    r.getCell(1).font = { bold: true, size: 10, color: { argb: TENUE } }
    r.getCell(2).value = v
    r.getCell(2).font = { size: 10 }
    r.getCell(2).alignment = { vertical: 'middle', wrapText: true }
    ctx.fila += 1
  }

  if (p.producto.descripcion) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = rotulo('Descripción', 'Description', idioma)
    r.getCell(1).font = { bold: true, size: 10, color: { argb: TENUE } }
    r.getCell(2).value = valor(p.producto.descripcion, tr, idioma)
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    ws.mergeCells(ctx.fila, 2, ctx.fila, 5)
    const largo = p.producto.descripcion.length * (idioma === 'ambos' ? 2 : 1)
    r.height = Math.min(110, 18 + largo / 3)
    ctx.fila += 1
  }

  if (conFotos && p.producto.foto) {
    const img = await bajarImagen(p.producto.foto)
    if (img) {
      const id = wb.addImage(img)
      ws.addImage(id, { tl: { col: 5.2, row: 0.2 }, ext: { width: 190, height: 190 } })
    }
  }
  ctx.fila += 1

  // --- detalles generales (los que valen para todos los estilos)
  const generales = p.specs.filter((s) => !s.config_id)
  if (generales.length) {
    seccion(ctx, 'DETALLES GENERALES', 'GENERAL SPECIFICATIONS')
    await tablaSpecs(ctx, generales, fotosPorSpec)
    ctx.fila += 1
  }

  // --- una sección por estilo
  const varias = mostrarVersiones(p)
  for (const cfg of p.configs) {
    if (varias) {
      seccion(ctx, `ESTILO: ${cfg.nombre}`, `STYLE: ${valorCorto(cfg.nombre, tr, idioma)}`,
        `${cfg.nombre}`)
      if (cfg.descripcion) {
        const r = ws.getRow(ctx.fila)
        r.getCell(1).value = valor(cfg.descripcion, tr, idioma)
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
        r.getCell(1).font = { italic: true, size: 10, color: { argb: TENUE } }
        ws.mergeCells(ctx.fila, 1, ctx.fila, 5)
        r.height = idioma === 'ambos' ? 32 : 18
        ctx.fila += 1
      }
      if (conFotos && cfg.foto) {
        const img = await bajarImagen(cfg.foto)
        if (img) {
          const id = wb.addImage(img)
          ws.addImage(id, {
            tl: { col: 5.2, row: ctx.fila - 1 + 0.1 },
            ext: { width: 150, height: 150 },
          })
        }
      }
    }

    const specsCfg = de(p.specs, cfg.id)
    if (specsCfg.length) {
      if (!varias) seccion(ctx, 'DETALLES', 'SPECIFICATIONS')
      await tablaSpecs(ctx, specsCfg, fotosPorSpec)
      ctx.fila += 1
    }

    await tablaMatriz(ctx, p, cfg)
    await galeria(ctx, de(p.fotos, cfg.id).filter((f) => !f.spec_id))
    ctx.fila += 1
  }

  // --- notas del producto
  if (p.notas.length) {
    seccion(ctx, 'NOTAS', 'NOTES')
    for (const n of p.notas) {
      const r = ws.getRow(ctx.fila)
      r.getCell(1).value = new Date(n.created_at).toLocaleDateString('es-AR')
      r.getCell(1).font = { size: 9, color: { argb: TENUE } }
      r.getCell(1).alignment = { vertical: 'top' }
      r.getCell(2).value = valor(n.texto, tr, idioma)
      r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
      ws.mergeCells(ctx.fila, 2, ctx.fila, 6)
      const largo = n.texto.length * (idioma === 'ambos' ? 2 : 1)
      r.height = Math.min(90, 18 + largo / 5)
      ctx.fila += 1
    }
  }
}

// ------------------------------------------------------- bloques reusables

interface Ctx {
  ws: ExcelJS.Worksheet
  wb: ExcelJS.Workbook
  tr: Traducciones
  idioma: Idioma
  conFotos: boolean
  fila: number
}

function seccion(ctx: Ctx, es: string, en: string, soloTexto?: string) {
  const r = ctx.ws.getRow(ctx.fila)
  r.getCell(1).value = soloTexto && ctx.idioma === 'es' ? es : rotulo(es, en, ctx.idioma)
  r.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  for (let i = 1; i <= 8; i++) {
    r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } }
  }
  r.height = 20
  ctx.fila += 1
}

async function tablaSpecs(
  ctx: Ctx,
  specs: { id: string; nombre: string; valor: string | null; foto: string | null }[],
  fotosPorSpec: Map<string, { url: string; titulo: string | null }[]>,
) {
  const { ws, wb, tr, idioma, conFotos } = ctx
  const cab = ws.getRow(ctx.fila)
  cab.values = [
    rotulo('Detalle', 'Item', idioma),
    rotulo('Valor', 'Value', idioma),
    conFotos ? rotulo('Imágenes', 'Images', idioma) : '',
  ]
  cab.eachCell((c) => {
    c.font = { bold: true, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    c.border = borde
  })
  ctx.fila += 1

  for (const s of specs) {
    // la foto suelta del detalle más todas las imágenes que se le cargaron
    const imagenes = [
      ...(s.foto ? [{ url: s.foto, titulo: null as string | null }] : []),
      ...(fotosPorSpec.get(s.id) ?? []),
    ]

    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = valor(s.nombre, tr, idioma)
    r.getCell(1).font = { bold: true, size: 10 }
    r.getCell(1).alignment = { vertical: 'top', wrapText: true }
    r.getCell(1).border = borde
    r.getCell(2).value = valor(s.valor, tr, idioma)
    r.getCell(2).alignment = { vertical: 'top', wrapText: true }
    r.getCell(2).border = borde
    for (let i = 3; i <= 8; i++) r.getCell(i).border = borde

    let alto = idioma === 'ambos' ? 34 : 24

    if (conFotos && imagenes.length) {
      alto = 84
      let col = 0
      for (const im of imagenes) {
        if (col >= 6) break // no más de 6 por detalle, no entran a lo ancho
        const img = await bajarImagen(im.url)
        if (!img) continue
        const id = wb.addImage(img)
        ws.addImage(id, {
          tl: { col: 2.08 + col, row: ctx.fila - 1 + 0.08 },
          ext: { width: 88, height: 88 },
        })
        col += 1
      }

      // el texto de cada imagen, en la fila de abajo y bajo su imagen
      const conTexto = imagenes.slice(0, 6).filter((im) => im.titulo)
      if (conTexto.length) {
        ctx.fila += 1
        const rTextos = ws.getRow(ctx.fila)
        imagenes.slice(0, 6).forEach((im, i) => {
          if (!im.titulo) return
          const cel = rTextos.getCell(3 + i)
          cel.value = valor(im.titulo, tr, idioma)
          cel.font = { size: 9, color: { argb: TENUE } }
          cel.alignment = { vertical: 'top', wrapText: true, horizontal: 'center' }
        })
        rTextos.height = idioma === 'ambos' ? 28 : 16
        ws.getRow(ctx.fila - 1).height = alto
        ctx.fila += 1
        continue
      }
    }

    const largo = (s.valor?.length ?? 0) * (idioma === 'ambos' ? 2 : 1)
    r.height = Math.max(alto, Math.min(110, 18 + largo / 2.5))
    ctx.fila += 1
  }
}

async function tablaMatriz(ctx: Ctx, p: ProductoCompleto, cfg: Configuracion) {
  const { ws, wb, tr, idioma } = ctx
  const medidas = de(p.medidas, cfg.id)
  const colores = de(p.colores, cfg.id)
  if (!medidas.length || !colores.length) return

  seccion(ctx, 'CANTIDADES POR MEDIDA Y COLOR', 'QUANTITIES BY SIZE AND COLOR')

  // fila de muestras: la foto de cada color arriba de su columna
  if (ctx.conFotos && colores.some((c) => c.foto)) {
    const rMuestras = ws.getRow(ctx.fila)
    rMuestras.height = 56
    for (let i = 0; i < colores.length; i++) {
      const foto = colores[i].foto
      if (!foto) continue
      const img = await bajarImagen(foto)
      if (!img) continue
      const id = wb.addImage(img)
      ws.addImage(id, {
        tl: { col: 1 + i + 0.1, row: ctx.fila - 1 + 0.05 },
        ext: { width: 66, height: 66 },
      })
    }
    ctx.fila += 1
  }

  const cab = ws.getRow(ctx.fila)
  cab.getCell(1).value = rotulo('Medida', 'Size', idioma)
  colores.forEach((c, i) => { cab.getCell(2 + i).value = valorCorto(c.nombre, tr, idioma) })
  cab.getCell(2 + colores.length).value = 'Total'
  cab.height = 26
  for (let i = 1; i <= colores.length + 2; i++) {
    const c = cab.getCell(i)
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = borde
  }
  ctx.fila += 1

  const totalPorColor = new Array(colores.length).fill(0)
  let totalGeneral = 0

  for (const m of medidas) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = m.detalle
      ? `${valorCorto(m.nombre, tr, idioma)} — ${valorCorto(m.detalle, tr, idioma)}`
      : valorCorto(m.nombre, tr, idioma)
    r.getCell(1).font = { bold: true, size: 10 }
    r.getCell(1).alignment = { vertical: 'middle', wrapText: true }
    r.getCell(1).border = borde

    let totalFila = 0
    colores.forEach((c, i) => {
      const cant = cantidadDe(p, m.id, c.id)
      const cel = r.getCell(2 + i)
      cel.value = cant || ''
      cel.numFmt = '#,##0'
      cel.alignment = { horizontal: 'center', vertical: 'middle' }
      cel.border = borde
      totalFila += cant
      totalPorColor[i] += cant
    })

    const celTotal = r.getCell(2 + colores.length)
    celTotal.value = totalFila
    celTotal.numFmt = '#,##0'
    celTotal.font = { bold: true }
    celTotal.alignment = { horizontal: 'center', vertical: 'middle' }
    celTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    celTotal.border = borde
    totalGeneral += totalFila
    r.height = 22
    ctx.fila += 1
  }

  const rTot = ws.getRow(ctx.fila)
  rTot.getCell(1).value = 'Total'
  totalPorColor.forEach((t, i) => {
    const c = rTot.getCell(2 + i)
    c.value = t
    c.numFmt = '#,##0'
  })
  rTot.getCell(2 + colores.length).value = totalGeneral
  rTot.getCell(2 + colores.length).numFmt = '#,##0'
  for (let i = 1; i <= colores.length + 2; i++) {
    const c = rTot.getCell(i)
    c.font = { bold: true, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    c.border = borde
    if (i > 1) c.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  rTot.height = 20
  ctx.fila += 2

  // precios, solo si hay alguno cargado en este estilo
  const conPrecio = medidas.filter((m) => m.precio_unit != null)
  if (!conPrecio.length) return

  seccion(ctx, `PRECIOS (${p.producto.moneda})`, `PRICES (${p.producto.moneda})`)
  const cab2 = ws.getRow(ctx.fila)
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
  ctx.fila += 1

  let acumulado = 0
  for (const m of conPrecio) {
    const cant = colores.reduce((s, c) => s + cantidadDe(p, m.id, c.id), 0)
    const sub = Number(m.precio_unit) * cant
    acumulado += sub
    const r = ws.getRow(ctx.fila)
    r.values = [valorCorto(m.nombre, tr, idioma), Number(m.precio_unit), cant, sub]
    r.getCell(2).numFmt = '#,##0.0000'
    r.getCell(3).numFmt = '#,##0'
    r.getCell(4).numFmt = '#,##0.00'
    r.eachCell((c) => { c.border = borde })
    ctx.fila += 1
  }
  const rFin = ws.getRow(ctx.fila)
  rFin.getCell(3).value = 'TOTAL'
  rFin.getCell(4).value = acumulado
  rFin.getCell(4).numFmt = '#,##0.00'
  rFin.getCell(3).font = { bold: true }
  rFin.getCell(4).font = { bold: true }
  ctx.fila += 2
}

async function galeria(
  ctx: Ctx,
  fotos: { url: string; titulo: string | null }[],
) {
  if (!ctx.conFotos || !fotos.length) return
  const { ws, wb, tr, idioma } = ctx
  seccion(ctx, 'FOTOS DE REFERENCIA', 'REFERENCE PHOTOS')

  const filaBase = ctx.fila
  let col = 0
  for (const f of fotos) {
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
  ctx.fila = filaBase + filasUsadas + 1
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
