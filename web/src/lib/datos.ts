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

/**
 * ¿El error es porque la sesión dejó de valer?
 *
 * Pasa, por ejemplo, si se cambia la contraseña del usuario: el navegador
 * sigue teniendo una sesión guardada pero el servidor ya la rechaza. Sin
 * esto, las consultas volvían vacías y la app decía "este producto ya no
 * existe" cuando el producto estaba perfecto.
 */
function esSesionVencida(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; status?: number }
  if (e.status === 401 || e.status === 403) return true
  if (e.code === 'PGRST301' || e.code === '401') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('jwt') || m.includes('token') || m.includes('not authenticated')
}

/** Si la sesión venció, cerrarla para que la app vuelva a pedir el PIN. */
async function revisarSesion(error: unknown) {
  if (!esSesionVencida(error)) return false
  await supabase.auth.signOut()
  return true
}

/** Ejecuta una escritura y avisa a las pantallas abiertas. */
async function escribir<T>(consulta: PromiseLike<T>): Promise<T> {
  const r = await consulta
  const err = (r as { error?: unknown })?.error
  if (err) await revisarSesion(err)
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
  /** hubo un problema al traer los datos: NO es que el producto no exista */
  const [falla, setFalla] = useState(false)

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
    if (p.error) {
      // la consulta falló: puede ser la sesión o la conexión, pero el
      // producto sigue estando. No lo damos por borrado.
      await revisarSesion(p.error)
      setFalla(true)
      setCargando(false)
      return
    }
    if (!p.data) { setDatos(null); setFalla(false); setCargando(false); return }
    setFalla(false)
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

  return { datos, cargando, falla, recargar: cargar }
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

  /**
   * Guarda el porcentaje de una celda y, si el diseño tiene cargado el
   * contenedor, deja también las unidades que le corresponden.
   */
  setPorcentaje: (
    producto_id: string, config_id: string,
    medida_id: string, color_id: string,
    porcentaje: number | null, totalContenedor: number | null,
  ) =>
    escribir(supabase.from('variantes').upsert(
      {
        producto_id, config_id, medida_id, color_id, porcentaje,
        cantidad: porcentaje != null && totalContenedor
          ? Math.round(totalContenedor * porcentaje / 100)
          : 0,
      },
      { onConflict: 'medida_id,color_id' },
    )),

  /** Reparte de una todas las celdas de un diseño. */
  setVariasCeldas: (filas: Record<string, unknown>[]) =>
    escribir(supabase.from('variantes').upsert(filas, { onConflict: 'medida_id,color_id' })),
}

// --------------------------------------------------------------- destinos

/** Un lugar al que se puede copiar un detalle. */
export interface Destino {
  productoId: string
  productoNombre: string
  /** null = los detalles generales del producto */
  configId: string | null
  configNombre: string
  foto: string | null
}

/**
 * Todos los diseños de todos los productos, con una foto para reconocerlos.
 * Es la lista que se muestra al copiar un detalle a otro lado.
 */
export async function traerDestinos(): Promise<Destino[]> {
  const [prods, cfgs, fotos] = await Promise.all([
    supabase.from('productos').select('id,nombre,foto,archivado').order('updated_at', { ascending: false }),
    supabase.from('configuraciones').select('id,producto_id,nombre,foto').order('orden'),
    supabase.from('fotos').select('config_id,url,orden').is('spec_id', null).order('orden'),
  ])

  const productos = ((prods.data ?? []) as { id: string; nombre: string; foto: string | null; archivado: boolean }[])
    .filter((p) => !p.archivado)
  const configs = (cfgs.data ?? []) as { id: string; producto_id: string; nombre: string; foto: string | null }[]

  // primera foto de cada diseño, para la miniatura
  const portada = new Map<string, string>()
  for (const f of (fotos.data ?? []) as { config_id: string | null; url: string }[]) {
    if (f.config_id && !portada.has(f.config_id)) portada.set(f.config_id, f.url)
  }

  const out: Destino[] = []
  for (const p of productos) {
    out.push({
      productoId: p.id,
      productoNombre: p.nombre,
      configId: null,
      configNombre: 'Detalles generales',
      foto: p.foto,
    })
    for (const c of configs.filter((x) => x.producto_id === p.id)) {
      out.push({
        productoId: p.id,
        productoNombre: p.nombre,
        configId: c.id,
        configNombre: c.nombre,
        foto: c.foto ?? portada.get(c.id) ?? null,
      })
    }
  }
  return out
}

/**
 * Copia un detalle —con su texto y todas sus imágenes— a otros diseños,
 * del mismo producto o de otros. Las imágenes se referencian, no se vuelven
 * a subir: es el mismo archivo del storage.
 */
export async function copiarSpecA(
  spec: { nombre: string; valor: string | null; foto: string | null; definido: boolean; opcion_id: string | null },
  imagenes: { url: string; titulo: string | null }[],
  destinos: Destino[],
) {
  for (const d of destinos) {
    const { data } = await supabase.from('especificaciones').insert({
      producto_id: d.productoId,
      config_id: d.configId,
      opcion_id: spec.opcion_id,
      nombre: spec.nombre,
      valor: spec.valor,
      foto: spec.foto,
      definido: spec.definido,
      orden: 99,
    }).select().single()
    if (!data) continue

    if (imagenes.length) {
      await supabase.from('fotos').insert(imagenes.map((im, i) => ({
        producto_id: d.productoId,
        config_id: d.configId,
        spec_id: data.id as string,
        url: im.url,
        titulo: im.titulo,
        orden: i,
      })))
    }
  }
  avisarCambio()
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
