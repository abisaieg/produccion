import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { db } from './datos'
import type { Opcion } from './tipos'

/**
 * Biblioteca de opciones reutilizables (packagings, inserts, telas…).
 * Se carga una vez, con foto, y después se elige de una lista visual en
 * cada estilo del producto.
 */
export function useBiblioteca(tipo: string | null) {
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!tipo) { setOpciones([]); setCargando(false); return }
    const { data } = await supabase
      .from('opciones')
      .select('*')
      .eq('tipo', tipo)
      .order('usos', { ascending: false })
      .order('created_at', { ascending: false })
    setOpciones((data ?? []) as Opcion[])
    setCargando(false)
  }, [tipo])

  useEffect(() => { setCargando(true); cargar() }, [cargar])

  return { opciones, cargando, recargar: cargar }
}

/** Los tipos de detalle que ya existen, para sugerirlos. */
export function useTiposUsados() {
  const [tipos, setTipos] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('v_tipos_opcion')
      .select('tipo')
      .then(({ data }) => setTipos(((data ?? []) as { tipo: string }[]).map((t) => t.tipo)))
  }, [])

  return tipos
}

export async function crearOpcion(o: {
  tipo: string
  nombre: string
  detalle?: string | null
  foto?: string | null
}) {
  const { data } = await db.agregar('opciones', {
    tipo: o.tipo,
    nombre: o.nombre,
    detalle: o.detalle ?? null,
    foto: o.foto ?? null,
  })
  return data as Opcion | null
}

/**
 * Al elegir una opción se copian nombre, detalle y foto al detalle del
 * producto. Es a propósito: si mañana cambiás la opción en la biblioteca,
 * los pedidos ya armados no se alteran.
 */
export function comoDetalle(op: Opcion) {
  return {
    opcion_id: op.id,
    nombre: op.tipo,
    valor: op.detalle ? `${op.nombre} — ${op.detalle}` : op.nombre,
    foto: op.foto,
  }
}
