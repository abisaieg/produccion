import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type {
  Color, Configuracion, Especificacion, Foto, Medida, Nota, Producto,
  ProductoCompleto, Variante,
} from './tipos'

/**
 * Aviso local de "algo cambió".
 *
 * Cada escritura de esta misma pestaña lo dispara, así la pantalla se
 * actualiza sí o sí. Antes esto dependía solo de Realtime y si esa conexión
 * no enganchaba, borrabas algo y la fila seguía en pantalla.
 */
const oyentes = new Set<() => void>()

function avisarCambio() {
  for (const fn of oyentes) fn()
}

/** Ejecuta una escritura y avisa a las pantallas abiertas. */
async function escribir<T>(consulta: PromiseLike<T>): Promise<T> {
  const r = await consulta
  avisarCambio()
  return r
}

/** Se dispara ante un cambio propio (al instante) o de otra persona (Realtime). */
function useCambios(onCambio: () => void, canal: string) {
  const cb = useRef(onCambio)
  cb.current = onCambio

  // cambios propios
  useEffect(() => {
    const fn = () => cb.current()
    oyentes.add(fn)
    return () => { oyentes.delete(fn) }
  }, [])

  // cambios de otras personas
  useEffect(() => {
    const sub = supabase
      .channel(canal)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => cb.current())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [canal])

  // al volver a la pestaña, refrescar por las dudas
  useEffect(() => {
    const alVolver = () => { if (!document.hidden) cb.current() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])
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
  useCambios(cargar, 'lista-productos')

  return { productos, cargando, recargar: cargar }
}

// ------------------------------------------------------------------- ficha

const TABLAS = [
  'configuraciones', 'especificaciones', 'fotos', 'medidas', 'colores', 'variantes', 'notas',
] as const

export function useProducto(id: string | null) {
  const [datos, setDatos] = useState<ProductoCompleto | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!id) { setDatos(null); setCargando(false); return }
    const [p, configs, specs, fotos, medidas, colores, variantes, notas] = await Promise.all([
      supabase.from('productos').select('*').eq('id', id).single(),
      supabase.from('configuraciones').select('*').eq('producto_id', id).order('orden'),
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
      configs: (configs.data ?? []) as Configuracion[],
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
  useCambios(cargar, `ficha-${id ?? 'nada'}`)

  return { datos, cargando, recargar: cargar }
}

// ------------------------------------------------------------------- carga

/** Trae varios productos completos de una (para exportar). */
export async function traerCompletos(ids: string[]): Promise<ProductoCompleto[]> {
  if (!ids.length) return []
  const [p, ...resto] = await Promise.all([
    supabase.from('productos').select('*').in('id', ids),
    ...TABLAS.map((t) => {
      const q = supabase.from(t).select('*').in('producto_id', ids)
      return t === 'notas'
        ? q.order('created_at', { ascending: false })
        : t === 'variantes' ? q : q.order('orden')
    }),
  ])

  const productos = (p.data ?? []) as Producto[]
  productos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))

  const [configs, specs, fotos, medidas, colores, variantes, notas] = resto
  const filtrar = <T extends { producto_id: string }>(r: { data: unknown }, pid: string) =>
    ((r.data ?? []) as T[]).filter((x) => x.producto_id === pid)

  return productos.map((prod) => ({
    producto: prod,
    configs: filtrar<Configuracion>(configs, prod.id),
    specs: filtrar<Especificacion>(specs, prod.id),
    fotos: filtrar<Foto>(fotos, prod.id),
    medidas: filtrar<Medida>(medidas, prod.id),
    colores: filtrar<Color>(colores, prod.id),
    variantes: filtrar<Variante>(variantes, prod.id),
    notas: filtrar<Nota>(notas, prod.id),
  }))
}

// ---------------------------------------------------------------- escritura

export const db = {
  crearProducto: (p: Partial<Producto>) =>
    escribir(supabase.from('productos').insert(p).select().single()),
  actualizarProducto: (id: string, cambios: Partial<Producto>) =>
    escribir(supabase.from('productos').update(cambios).eq('id', id)),
  borrarProducto: (id: string) =>
    escribir(supabase.from('productos').delete().eq('id', id)),

  agregar: (tabla: string, fila: Record<string, unknown>) =>
    escribir(supabase.from(tabla).insert(fila).select().single()),
  agregarVarias: (tabla: string, filas: Record<string, unknown>[]) =>
    escribir(supabase.from(tabla).insert(filas).select()),
  actualizar: (tabla: string, id: string, cambios: Record<string, unknown>) =>
    escribir(supabase.from(tabla).update(cambios).eq('id', id)),
  borrar: (tabla: string, id: string) =>
    escribir(supabase.from(tabla).delete().eq('id', id)),

  /** Guarda la cantidad de una celda de la matriz (crea la fila si no existía). */
  setCantidad: (
    producto_id: string, config_id: string,
    medida_id: string, color_id: string, cantidad: number,
  ) =>
    escribir(supabase.from('variantes').upsert(
      { producto_id, config_id, medida_id, color_id, cantidad },
      { onConflict: 'medida_id,color_id' },
    )),
}

// ------------------------------------------------------------- duplicados

/** Copia una configuración completa dentro del mismo producto. */
export async function duplicarConfig(
  productoId: string,
  origen: {
    config: Configuracion
    specs: Especificacion[]
    medidas: Medida[]
    colores: Color[]
    variantes: Variante[]
    fotos: Foto[]
  },
  ordenNuevo: number,
): Promise<string | null> {
  const { data: nueva } = await supabase.from('configuraciones').insert({
    producto_id: productoId,
    nombre: `${origen.config.nombre} (copia)`,
    descripcion: origen.config.descripcion,
    foto: origen.config.foto,
    orden: ordenNuevo,
  }).select().single()
  if (!nueva) return null
  const cid = nueva.id as string

  await copiarHijos(productoId, cid, origen)
  return cid
}

/** Recrea medidas/colores/specs/fotos/matriz bajo una configuración destino. */
async function copiarHijos(
  productoId: string,
  configId: string,
  o: {
    specs: Especificacion[]
    medidas: Medida[]
    colores: Color[]
    variantes: Variante[]
    fotos: Foto[]
  },
) {
  if (o.specs.length)
    await supabase.from('especificaciones').insert(o.specs.map((s) => ({
      producto_id: productoId, config_id: configId, nombre: s.nombre,
      valor: s.valor, foto: s.foto, definido: s.definido, orden: s.orden,
    })))

  if (o.fotos.length)
    await supabase.from('fotos').insert(o.fotos.map((f) => ({
      producto_id: productoId, config_id: configId,
      url: f.url, titulo: f.titulo, orden: f.orden,
    })))

  // medidas y colores se recrean con id nuevo; hay que remapear la matriz
  const mapaMedida = new Map<string, string>()
  const mapaColor = new Map<string, string>()

  if (o.medidas.length) {
    const { data } = await supabase.from('medidas').insert(
      o.medidas.map((m) => ({
        producto_id: productoId, config_id: configId, nombre: m.nombre,
        detalle: m.detalle, precio_unit: m.precio_unit, orden: m.orden,
      })),
    ).select()
    o.medidas.forEach((m, i) => {
      const nuevo = (data ?? [])[i]
      if (nuevo) mapaMedida.set(m.id, nuevo.id as string)
    })
  }

  if (o.colores.length) {
    const { data } = await supabase.from('colores').insert(
      o.colores.map((c) => ({
        producto_id: productoId, config_id: configId, nombre: c.nombre,
        hex: c.hex, foto: c.foto, orden: c.orden,
      })),
    ).select()
    o.colores.forEach((c, i) => {
      const nuevo = (data ?? [])[i]
      if (nuevo) mapaColor.set(c.id, nuevo.id as string)
    })
  }

  const nuevas = o.variantes
    .map((v) => ({
      producto_id: productoId,
      config_id: configId,
      medida_id: mapaMedida.get(v.medida_id),
      color_id: mapaColor.get(v.color_id),
      cantidad: v.cantidad,
      precio_unit: v.precio_unit,
      notas: v.notas,
    }))
    .filter((v) => v.medida_id && v.color_id)
  if (nuevas.length) await supabase.from('variantes').insert(nuevas)
}

/** Duplica un producto entero con todas sus configuraciones. */
export async function duplicarProducto(id: string): Promise<string | null> {
  const [orig] = await traerCompletos([id])
  if (!orig) return null

  const { data: nuevo } = await supabase.from('productos').insert({
    nombre: `${orig.producto.nombre} (copia)`,
    codigo: orig.producto.codigo,
    proveedor: orig.producto.proveedor,
    categoria: orig.producto.categoria,
    estado: 'idea',
    descripcion: orig.producto.descripcion,
    pendiente: orig.producto.pendiente,
    foto: orig.producto.foto,
    moneda: orig.producto.moneda,
  }).select().single()
  if (!nuevo) return null
  const pid = nuevo.id as string

  // el trigger de la base ya creó una configuración "Principal": la borramos
  // para quedarnos exactamente con las del producto original
  await supabase.from('configuraciones').delete().eq('producto_id', pid)

  // detalles generales (los que no cuelgan de ninguna configuración)
  const generales = orig.specs.filter((s) => !s.config_id)
  if (generales.length)
    await supabase.from('especificaciones').insert(generales.map((s) => ({
      producto_id: pid, config_id: null, nombre: s.nombre, valor: s.valor,
      foto: s.foto, definido: s.definido, orden: s.orden,
    })))

  for (const c of orig.configs) {
    const { data: nuevaConfig } = await supabase.from('configuraciones').insert({
      producto_id: pid, nombre: c.nombre, descripcion: c.descripcion,
      foto: c.foto, orden: c.orden,
    }).select().single()
    if (!nuevaConfig) continue

    await copiarHijos(pid, nuevaConfig.id as string, {
      specs: orig.specs.filter((s) => s.config_id === c.id),
      medidas: orig.medidas.filter((m) => m.config_id === c.id),
      colores: orig.colores.filter((x) => x.config_id === c.id),
      variantes: orig.variantes.filter((v) => v.config_id === c.id),
      fotos: orig.fotos.filter((f) => f.config_id === c.id),
    })
  }

  return pid
}
