import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type {
  Color, Especificacion, Foto, Medida, Nota, Producto, ProductoCompleto, Variante,
} from './tipos'

/** Se dispara cuando cualquier tabla cambia (propio o de otra persona). */
function useRealtime(onCambio: () => void, canal: string) {
  const cb = useRef(onCambio)
  cb.current = onCambio
  useEffect(() => {
    const sub = supabase
      .channel(canal)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => cb.current())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [canal])
}

// ------------------------------------------------------------------ listado

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('*')
      .order('archivado', { ascending: true })
      .order('updated_at', { ascending: false })
    setProductos((data ?? []) as Producto[])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useRealtime(cargar, 'lista-productos')

  return { productos, cargando, recargar: cargar }
}

// ------------------------------------------------------------------- ficha

export function useProducto(id: string | null) {
  const [datos, setDatos] = useState<ProductoCompleto | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!id) { setDatos(null); setCargando(false); return }
    const [p, specs, fotos, medidas, colores, variantes, notas] = await Promise.all([
      supabase.from('productos').select('*').eq('id', id).single(),
      supabase.from('especificaciones').select('*').eq('producto_id', id).order('orden'),
      supabase.from('fotos').select('*').eq('producto_id', id).order('orden'),
      supabase.from('medidas').select('*').eq('producto_id', id).order('orden'),
      supabase.from('colores').select('*').eq('producto_id', id).order('orden'),
      supabase.from('variantes').select('*').eq('producto_id', id),
      supabase.from('notas').select('*').eq('producto_id', id).order('created_at', { ascending: false }),
    ])
    if (!p.data) { setDatos(null); setCargando(false); return }
    setDatos({
      producto: p.data as Producto,
      specs: (specs.data ?? []) as Especificacion[],
      fotos: (fotos.data ?? []) as Foto[],
      medidas: (medidas.data ?? []) as Medida[],
      colores: (colores.data ?? []) as Color[],
      variantes: (variantes.data ?? []) as Variante[],
      notas: (notas.data ?? []) as Nota[],
    })
    setCargando(false)
  }, [id])

  useEffect(() => { setCargando(true); cargar() }, [cargar])
  useRealtime(cargar, `ficha-${id ?? 'nada'}`)

  return { datos, cargando, recargar: cargar }
}

// ------------------------------------------------------------------- carga
/** Trae varios productos completos de una (para exportar). */
export async function traerCompletos(ids: string[]): Promise<ProductoCompleto[]> {
  if (!ids.length) return []
  const [p, specs, fotos, medidas, colores, variantes, notas] = await Promise.all([
    supabase.from('productos').select('*').in('id', ids),
    supabase.from('especificaciones').select('*').in('producto_id', ids).order('orden'),
    supabase.from('fotos').select('*').in('producto_id', ids).order('orden'),
    supabase.from('medidas').select('*').in('producto_id', ids).order('orden'),
    supabase.from('colores').select('*').in('producto_id', ids).order('orden'),
    supabase.from('variantes').select('*').in('producto_id', ids),
    supabase.from('notas').select('*').in('producto_id', ids).order('created_at', { ascending: false }),
  ])
  const productos = (p.data ?? []) as Producto[]
  // respetar el orden en que el usuario los selecciono
  productos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  const filtrar = <T extends { producto_id: string }>(arr: T[] | null, pid: string) =>
    (arr ?? []).filter((x) => x.producto_id === pid)

  return productos.map((prod) => ({
    producto: prod,
    specs: filtrar(specs.data as Especificacion[], prod.id),
    fotos: filtrar(fotos.data as Foto[], prod.id),
    medidas: filtrar(medidas.data as Medida[], prod.id),
    colores: filtrar(colores.data as Color[], prod.id),
    variantes: filtrar(variantes.data as Variante[], prod.id),
    notas: filtrar(notas.data as Nota[], prod.id),
  }))
}

// ---------------------------------------------------------------- escritura

export const db = {
  crearProducto: (p: Partial<Producto>) =>
    supabase.from('productos').insert(p).select().single(),
  actualizarProducto: (id: string, cambios: Partial<Producto>) =>
    supabase.from('productos').update(cambios).eq('id', id),
  borrarProducto: (id: string) =>
    supabase.from('productos').delete().eq('id', id),

  agregar: (tabla: string, fila: Record<string, unknown>) =>
    supabase.from(tabla).insert(fila).select().single(),
  actualizar: (tabla: string, id: string, cambios: Record<string, unknown>) =>
    supabase.from(tabla).update(cambios).eq('id', id),
  borrar: (tabla: string, id: string) =>
    supabase.from(tabla).delete().eq('id', id),

  /** Guarda la cantidad de una celda de la matriz (crea la fila si no existía). */
  setCantidad: (producto_id: string, medida_id: string, color_id: string, cantidad: number) =>
    supabase.from('variantes').upsert(
      { producto_id, medida_id, color_id, cantidad },
      { onConflict: 'medida_id,color_id' },
    ),
}

/** Duplica un producto entero con todos sus hijos. */
export async function duplicarProducto(id: string): Promise<string | null> {
  const [orig] = await traerCompletos([id])
  if (!orig) return null

  const { data: nuevo } = await supabase
    .from('productos')
    .insert({
      nombre: `${orig.producto.nombre} (copia)`,
      codigo: orig.producto.codigo,
      proveedor: orig.producto.proveedor,
      categoria: orig.producto.categoria,
      estado: 'idea',
      descripcion: orig.producto.descripcion,
      pendiente: orig.producto.pendiente,
      foto: orig.producto.foto,
      moneda: orig.producto.moneda,
    })
    .select()
    .single()
  if (!nuevo) return null
  const pid = nuevo.id as string

  if (orig.specs.length)
    await supabase.from('especificaciones').insert(
      orig.specs.map((s) => ({
        producto_id: pid, nombre: s.nombre, valor: s.valor, foto: s.foto,
        definido: s.definido, orden: s.orden,
      })))

  if (orig.fotos.length)
    await supabase.from('fotos').insert(
      orig.fotos.map((f) => ({ producto_id: pid, url: f.url, titulo: f.titulo, orden: f.orden })))

  // medidas y colores se recrean con id nuevo; mapeamos para rearmar la matriz
  const mapaMedida = new Map<string, string>()
  const mapaColor = new Map<string, string>()

  for (const m of orig.medidas) {
    const { data } = await supabase.from('medidas').insert({
      producto_id: pid, nombre: m.nombre, detalle: m.detalle,
      precio_unit: m.precio_unit, orden: m.orden,
    }).select().single()
    if (data) mapaMedida.set(m.id, data.id as string)
  }
  for (const c of orig.colores) {
    const { data } = await supabase.from('colores').insert({
      producto_id: pid, nombre: c.nombre, hex: c.hex, foto: c.foto, orden: c.orden,
    }).select().single()
    if (data) mapaColor.set(c.id, data.id as string)
  }

  const nuevasVariantes = orig.variantes
    .map((v) => ({
      producto_id: pid,
      medida_id: mapaMedida.get(v.medida_id),
      color_id: mapaColor.get(v.color_id),
      cantidad: v.cantidad,
      precio_unit: v.precio_unit,
      notas: v.notas,
    }))
    .filter((v) => v.medida_id && v.color_id)
  if (nuevasVariantes.length) await supabase.from('variantes').insert(nuevasVariantes)

  return pid
}
