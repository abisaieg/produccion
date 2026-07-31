import type ExcelJS from 'exceljs'
import type { ProductoCompleto } from './tipos'
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

/** Imágenes que no se pudieron incluir en la última exportación. */
let imagenesOmitidas: string[] = []

export function imagenesQueFaltaron() {
  return imagenesOmitidas
}

async function bajarImagen(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      imagenesOmitidas.push('archivo no encontrado')
      return null
    }
    const tipo = res.headers.get('content-type') ?? ''
    const ext = tipo.includes('png') ? 'png' : tipo.includes('gif') ? 'gif'
      : tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpeg' : null
    if (!ext) {
      imagenesOmitidas.push(`formato ${tipo.replace('image/', '')}`)
      return null
    }
    return { buffer: await res.arrayBuffer(), extension: ext as 'png' | 'gif' | 'jpeg' }
  } catch {
    imagenesOmitidas.push('no se pudo descargar')
    return null
  }
}

function cantidadDe(p: ProductoCompleto, medidaId: string, colorId: string) {
  return p.variantes.find((x) => x.medida_id === medidaId && x.color_id === colorId)?.cantidad ?? 0
}

function pctDe(p: ProductoCompleto, medidaId: string, colorId: string): number | null {
  const v = p.variantes.find((x) => x.medida_id === medidaId && x.color_id === colorId)
  return v?.porcentaje != null ? Number(v.porcentaje) : null
}

/** El pedido se armó por porcentajes: entonces el dato es el porcentaje. */
function hayPorcentajes(p: ProductoCompleto) {
  return p.variantes.some((v) => v.porcentaje != null) ||
    p.medidas.some((m) => m.porcentaje != null)
}

// ---------------------------------------------------------------------------

interface Ctx {
  ws: ExcelJS.Worksheet
  wb: ExcelJS.Workbook
  tr: Traducciones
  idioma: Idioma
  conFotos: boolean
  fila: number
}

/** Ancho de la hoja: medida + hasta 9 colores + total. */
const COLS = 11

/**
 * Todo el pedido en una sola hoja, de arriba a abajo, y la matriz con una
 * fila por medida y un color por columna. Antes cada producto abría su
 * propia hoja y el pedido se listaba con una fila por combinación de medida
 * y color, lo que daba decenas de filas repetidas para leer lo mismo.
 */
export async function generarExcel(
  productos: ProductoCompleto[],
  op: OpcionesExport,
): Promise<Blob> {
  imagenesOmitidas = []

  const tr: Traducciones = op.idioma === 'es'
    ? new Map()
    : await traducir(textosDe(productos))

  // ExcelJS pesa ~1 MB: se carga recién cuando hace falta exportar
  const { default: Excel } = await import('exceljs')
  const wb = new Excel.Workbook()
  wb.creator = 'Producción'
  wb.created = new Date()

  const ws = wb.addWorksheet(rotulo('Pedido', 'Order', op.idioma), {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ws.columns = [
    { width: 30 }, { width: 34 },
    ...Array.from({ length: COLS - 3 }, () => ({ width: 16 })),
    { width: 14 },
  ]

  const ctx: Ctx = { ws, wb, tr, idioma: op.idioma, conFotos: op.conFotos, fila: 1 }

  for (let i = 0; i < productos.length; i++) {
    if (i > 0) ctx.fila += 2
    await bloqueProducto(ctx, productos[i])
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ------------------------------------------------------------- bloques

function titulo(ctx: Ctx, texto: string) {
  const r = ctx.ws.getRow(ctx.fila)
  r.getCell(1).value = texto
  r.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  for (let i = 1; i <= COLS; i++) {
    r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } }
  }
  r.height = 24
  ctx.fila += 1
}

function subtitulo(ctx: Ctx, texto: string) {
  const r = ctx.ws.getRow(ctx.fila)
  r.getCell(1).value = texto
  r.getCell(1).font = { bold: true, size: 10, color: { argb: NEGRO } }
  for (let i = 1; i <= COLS; i++) {
    r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
  }
  r.height = 18
  ctx.fila += 1
}

async function bloqueProducto(ctx: Ctx, p: ProductoCompleto) {
  const { ws, wb, tr, idioma, conFotos } = ctx

  // --- nombre del producto y, al lado, solo los datos que estén cargados
  const rTit = ws.getRow(ctx.fila)
  rTit.getCell(1).value = valorCorto(p.producto.nombre, tr, idioma).toUpperCase()
  rTit.getCell(1).font = { bold: true, size: 18, color: { argb: NEGRO } }
  rTit.getCell(1).alignment = { vertical: 'middle' }
  rTit.height = 28
  ws.mergeCells(ctx.fila, 1, ctx.fila, 4)

  const datos = [
    p.producto.codigo && `${rotulo('Cód.', 'Code', idioma)}: ${p.producto.codigo}`,
    p.producto.proveedor,
    valorCorto(p.producto.categoria, tr, idioma) || null,
  ].filter(Boolean)
  if (datos.length) {
    rTit.getCell(5).value = datos.join('  ·  ')
    rTit.getCell(5).font = { size: 10, color: { argb: TENUE } }
    rTit.getCell(5).alignment = { vertical: 'middle' }
  }
  ctx.fila += 1

  if (p.producto.descripcion) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = valor(p.producto.descripcion, tr, idioma)
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    ws.mergeCells(ctx.fila, 1, ctx.fila, COLS)
    r.height = idioma === 'ambos' ? 32 : 18
    ctx.fila += 1
  }

  if (conFotos && p.producto.foto) {
    const img = await bajarImagen(p.producto.foto)
    if (img) {
      const id = wb.addImage(img)
      ws.addImage(id, { tl: { col: 9.1, row: ctx.fila - 1 }, ext: { width: 110, height: 110 } })
      ctx.fila += 5
    }
  }
  ctx.fila += 1

  // --- detalles que valen para todos los estilos
  const generales = p.specs.filter((s) => !s.config_id)
  if (generales.length) {
    subtitulo(ctx, rotulo('DETALLES GENERALES', 'GENERAL SPECIFICATIONS', idioma))
    await tablaSpecs(ctx, p, generales)
    ctx.fila += 1
  }

  // --- un bloque por estilo
  const varios = p.configs.length > 1
  for (const cfg of p.configs) {
    const specs = de(p.specs, cfg.id)
    const medidas = de(p.medidas, cfg.id)
    const colores = de(p.colores, cfg.id)
    const galeria = de(p.fotos, cfg.id).filter((f) => !f.spec_id)
    if (!specs.length && !medidas.length && !galeria.length) continue

    if (varios) {
      const nomEn = tr.get(cfg.nombre.trim())
      titulo(ctx, rotulo(cfg.nombre, !nomEn ? cfg.nombre : nomEn, idioma))

      if (cfg.descripcion) {
        const r = ws.getRow(ctx.fila)
        r.getCell(1).value = valor(cfg.descripcion, tr, idioma)
        r.getCell(1).font = { italic: true, size: 10, color: { argb: TENUE } }
        r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
        ws.mergeCells(ctx.fila, 1, ctx.fila, COLS)
        r.height = idioma === 'ambos' ? 28 : 16
        ctx.fila += 1
      }
    }

    // las fotos del diseño van juntas y arriba de todo: son lo primero que
    // se mira para saber de qué producto se está hablando
    if (conFotos) {
      const delDiseno = [
        ...(cfg.foto ? [{ url: cfg.foto, titulo: null as string | null }] : []),
        ...galeria.map((f) => ({ url: f.url, titulo: f.titulo })),
      ]
      if (delDiseno.length) {
        await tiraFotos(ctx, delDiseno)
        ctx.fila += 1
      }
    }

    if (specs.length) {
      await tablaSpecs(ctx, p, specs)
      ctx.fila += 1
    }

    if (medidas.length && colores.length) {
      await matriz(ctx, p, medidas, colores, cfg.total_unidades)
      ctx.fila += 1
    }
  }

  // --- notas
  if (p.notas.length) {
    subtitulo(ctx, rotulo('NOTAS', 'NOTES', idioma))
    for (const n of p.notas) {
      const r = ws.getRow(ctx.fila)
      r.getCell(1).value = valor(n.texto, tr, idioma)
      r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
      ws.mergeCells(ctx.fila, 1, ctx.fila, COLS)
      const largo = n.texto.length * (idioma === 'ambos' ? 2 : 1)
      r.height = Math.min(80, 16 + largo / 8)
      ctx.fila += 1
    }
  }
}

// -------------------------------------------------- detalles con imágenes

async function tablaSpecs(
  ctx: Ctx,
  p: ProductoCompleto,
  specs: { id: string; nombre: string; valor: string | null; foto: string | null }[],
) {
  const { ws, wb, tr, idioma, conFotos } = ctx

  const porSpec = new Map<string, { url: string; titulo: string | null }[]>()
  for (const f of p.fotos) {
    if (!f.spec_id) continue
    const l = porSpec.get(f.spec_id) ?? []
    l.push({ url: f.url, titulo: f.titulo })
    porSpec.set(f.spec_id, l)
  }

  for (const s of specs) {
    const imagenes = [
      ...(s.foto ? [{ url: s.foto, titulo: null as string | null }] : []),
      ...(porSpec.get(s.id) ?? []),
    ]

    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = valor(s.nombre, tr, idioma)
    r.getCell(1).font = { bold: true, size: 10 }
    r.getCell(1).alignment = { vertical: 'top', wrapText: true }
    r.getCell(2).value = valor(s.valor, tr, idioma)
    r.getCell(2).alignment = { vertical: 'top', wrapText: true }
    for (let i = 1; i <= COLS; i++) r.getCell(i).border = borde

    const largo = (s.valor?.length ?? 0) * (idioma === 'ambos' ? 2 : 1)
    let alto = Math.max(idioma === 'ambos' ? 30 : 20, Math.min(90, 16 + largo / 3))

    if (conFotos && imagenes.length) {
      alto = Math.max(alto, 78)
      let col = 0
      for (const im of imagenes) {
        if (col >= COLS - 2) break
        const img = await bajarImagen(im.url)
        if (!img) continue
        const id = wb.addImage(img)
        ws.addImage(id, {
          tl: { col: 2.08 + col, row: ctx.fila - 1 + 0.06 },
          ext: { width: 84, height: 84 },
        })
        col += 1
      }
      r.height = alto
      ctx.fila += 1

      // el texto de cada imagen, justo debajo de la suya
      const visibles = imagenes.slice(0, COLS - 2)
      if (visibles.some((im) => im.titulo)) {
        const rt = ws.getRow(ctx.fila)
        visibles.forEach((im, i) => {
          if (!im.titulo) return
          const cel = rt.getCell(3 + i)
          cel.value = valor(im.titulo, tr, idioma)
          cel.font = { size: 8, color: { argb: TENUE } }
          cel.alignment = { vertical: 'top', wrapText: true, horizontal: 'center' }
        })
        const masLargo = Math.max(...visibles.map((im) => im.titulo?.length ?? 0))
        rt.height = Math.min(64, 14 + masLargo / (idioma === 'ambos' ? 1.3 : 2.4))
        for (let i = 1; i <= COLS; i++) rt.getCell(i).border = borde
        ctx.fila += 1
      }
      continue
    }

    r.height = alto
    ctx.fila += 1
  }
}

// ------------------------------ una fila por medida, un color por columna

async function matriz(
  ctx: Ctx,
  p: ProductoCompleto,
  medidas: ProductoCompleto['medidas'],
  colores: ProductoCompleto['colores'],
  contenedor: number | null,
) {
  const { ws, wb, tr, idioma, conFotos } = ctx
  const conPct = hayPorcentajes(p)
  const ultima = 2 + colores.length

  subtitulo(ctx, conPct
    ? rotulo('REPARTO POR MEDIDA Y COLOR (% DEL CONTENEDOR)',
             'BREAKDOWN BY SIZE AND COLOR (% OF CONTAINER)', idioma)
    : rotulo('CANTIDADES POR MEDIDA Y COLOR', 'QUANTITIES BY SIZE AND COLOR', idioma))

  if (contenedor) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = `${rotulo('Contenedor', 'Container', idioma)}: ` +
      `${contenedor.toLocaleString('es-AR')} ${rotulo('unidades', 'units', idioma)}`
    r.getCell(1).font = { size: 10, color: { argb: TENUE } }
    ws.mergeCells(ctx.fila, 1, ctx.fila, 3)
    ctx.fila += 1
  }

  // muestras de color arriba de su columna
  if (conFotos && colores.some((c) => c.foto)) {
    const r = ws.getRow(ctx.fila)
    r.height = 58
    for (let i = 0; i < colores.length; i++) {
      const foto = colores[i].foto
      if (!foto) continue
      const img = await bajarImagen(foto)
      if (!img) continue
      const id = wb.addImage(img)
      ws.addImage(id, {
        tl: { col: 1 + i + 0.15, row: ctx.fila - 1 + 0.06 },
        ext: { width: 68, height: 68 },
      })
    }
    ctx.fila += 1
  }

  const cab = ws.getRow(ctx.fila)
  cab.getCell(1).value = rotulo('Medida', 'Size', idioma)
  colores.forEach((c, i) => { cab.getCell(2 + i).value = valorCorto(c.nombre, tr, idioma) })
  cab.getCell(ultima).value = 'Total'
  cab.height = 26
  for (let i = 1; i <= ultima; i++) {
    const c = cab.getCell(i)
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = borde
  }
  ctx.fila += 1

  const totalColor = new Array(colores.length).fill(0)
  const pctColor = new Array(colores.length).fill(0)
  let totalGeneral = 0
  let pctGeneral = 0

  for (const m of medidas) {
    const r = ws.getRow(ctx.fila)
    r.getCell(1).value = m.detalle
      ? `${valorCorto(m.nombre, tr, idioma)} — ${valorCorto(m.detalle, tr, idioma)}`
      : valorCorto(m.nombre, tr, idioma)
    r.getCell(1).font = { bold: true, size: 10 }
    r.getCell(1).alignment = { vertical: 'middle', wrapText: true }
    r.getCell(1).border = borde

    let totalFila = 0
    let pctFila = 0
    colores.forEach((c, i) => {
      const cant = cantidadDe(p, m.id, c.id)
      const pc = pctDe(p, m.id, c.id)
      const cel = r.getCell(2 + i)
      if (conPct) {
        cel.value = pc != null ? pc / 100 : ''
        cel.numFmt = '0.00%'
      } else {
        cel.value = cant || ''
        cel.numFmt = '#,##0'
      }
      cel.alignment = { horizontal: 'center', vertical: 'middle' }
      cel.border = borde
      totalFila += cant
      pctFila += pc ?? 0
      totalColor[i] += cant
      pctColor[i] += pc ?? 0
    })

    const cel = r.getCell(ultima)
    if (conPct) {
      cel.value = pctFila / 100
      cel.numFmt = '0.00%'
    } else {
      cel.value = totalFila
      cel.numFmt = '#,##0'
    }
    cel.font = { bold: true }
    cel.alignment = { horizontal: 'center', vertical: 'middle' }
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    cel.border = borde

    totalGeneral += totalFila
    pctGeneral += pctFila
    r.height = 20
    ctx.fila += 1
  }

  const rTot = ws.getRow(ctx.fila)
  rTot.getCell(1).value = 'Total'
  colores.forEach((_, i) => {
    const c = rTot.getCell(2 + i)
    if (conPct) {
      c.value = pctColor[i] / 100
      c.numFmt = '0.00%'
    } else {
      c.value = totalColor[i]
      c.numFmt = '#,##0'
    }
  })
  const celGen = rTot.getCell(ultima)
  if (conPct) {
    celGen.value = pctGeneral / 100
    celGen.numFmt = '0.00%'
  } else {
    celGen.value = totalGeneral
    celGen.numFmt = '#,##0'
  }
  for (let i = 1; i <= ultima; i++) {
    const c = rTot.getCell(i)
    c.font = { bold: true, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    c.border = borde
    if (i > 1) c.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  rTot.height = 20
  ctx.fila += 1

  // precios, solo si se cargaron y el pedido va en unidades
  const conPrecio = conPct ? [] : medidas.filter((m) => m.precio_unit != null)
  if (!conPrecio.length) return

  const moneda = p.producto.moneda
  const rp = ws.getRow(ctx.fila)
  rp.getCell(1).value = rotulo(`Precio unitario (${moneda})`, `Unit price (${moneda})`, idioma)
  rp.getCell(1).font = { bold: true, size: 10, color: { argb: TENUE } }
  rp.getCell(1).border = borde
  rp.getCell(2).value = conPrecio
    .map((m) => `${valorCorto(m.nombre, tr, idioma)}: ${Number(m.precio_unit)}`)
    .join('  ·  ')
  rp.getCell(2).font = { size: 10 }
  rp.getCell(2).border = borde

  const acumulado = conPrecio.reduce((s, m) => {
    const cant = colores.reduce((t, c) => t + cantidadDe(p, m.id, c.id), 0)
    return s + Number(m.precio_unit) * cant
  }, 0)
  rp.getCell(ultima).value = acumulado
  rp.getCell(ultima).numFmt = '#,##0.00'
  rp.getCell(ultima).font = { bold: true }
  rp.getCell(ultima).border = borde
  ctx.fila += 1
}

// ----------------------------------------------------------- tira de fotos

async function tiraFotos(ctx: Ctx, fotos: { url: string; titulo: string | null }[]) {
  const { ws, wb, tr, idioma } = ctx
  const porFila = COLS - 1

  for (let inicio = 0; inicio < fotos.length; inicio += porFila) {
    const tanda = fotos.slice(inicio, inicio + porFila)
    const rImg = ws.getRow(ctx.fila)
    rImg.height = 90
    let puestas = 0
    for (let i = 0; i < tanda.length; i++) {
      const img = await bajarImagen(tanda[i].url)
      if (!img) continue
      const id = wb.addImage(img)
      ws.addImage(id, {
        tl: { col: i + 0.1, row: ctx.fila - 1 + 0.06 },
        ext: { width: 108, height: 108 },
      })
      puestas += 1
    }
    if (!puestas) continue
    ctx.fila += 1

    if (tanda.some((f) => f.titulo)) {
      const rt = ws.getRow(ctx.fila)
      tanda.forEach((f, i) => {
        if (!f.titulo) return
        const c = rt.getCell(1 + i)
        c.value = valor(f.titulo, tr, idioma)
        c.font = { size: 8, color: { argb: TENUE } }
        c.alignment = { vertical: 'top', wrapText: true, horizontal: 'center' }
      })
      rt.height = 30
      ctx.fila += 1
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
