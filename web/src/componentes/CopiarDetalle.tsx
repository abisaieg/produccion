import { useEffect, useMemo, useState } from 'react'
import { copiarSpecA, traerDestinos, type Destino } from '../lib/datos'
import type { Especificacion, Foto } from '../lib/tipos'
import { Modal } from './ui'

/**
 * Copiar un detalle a otros diseños, del mismo producto o de otros.
 * Se elige por la foto del diseño, que es como se los reconoce.
 */
export function CopiarDetalle({ spec, imagenes, configActual, onCerrar, onListo }: {
  spec: Especificacion
  imagenes: Foto[]
  /** el diseño donde ya está, para no ofrecerlo */
  configActual: string | null
  onCerrar: () => void
  onListo: (mensaje: string) => void
}) {
  const [destinos, setDestinos] = useState<Destino[] | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [copiando, setCopiando] = useState(false)

  useEffect(() => { traerDestinos().then(setDestinos) }, [])

  const clave = (d: Destino) => `${d.productoId}|${d.configId ?? 'gen'}`

  // agrupados por producto, salteando el diseño donde ya está el detalle
  const porProducto = useMemo(() => {
    const grupos = new Map<string, { nombre: string; items: Destino[] }>()
    for (const d of destinos ?? []) {
      if (d.configId === configActual && configActual !== null) continue
      if (d.configId === null && configActual === null && d.productoId === spec.producto_id) continue
      const g = grupos.get(d.productoId) ?? { nombre: d.productoNombre, items: [] }
      g.items.push(d)
      grupos.set(d.productoId, g)
    }
    return [...grupos.entries()]
  }, [destinos, configActual, spec.producto_id])

  const alternar = (d: Destino) => {
    setElegidos((prev) => {
      const s = new Set(prev)
      const k = clave(d)
      s.has(k) ? s.delete(k) : s.add(k)
      return s
    })
  }

  const copiar = async () => {
    if (!destinos) return
    const elegidosReales = destinos.filter((d) => elegidos.has(clave(d)))
    if (!elegidosReales.length) return
    setCopiando(true)
    await copiarSpecA(
      spec,
      imagenes.map((f) => ({ url: f.url, titulo: f.titulo })),
      elegidosReales,
    )
    setCopiando(false)
    onListo(
      elegidosReales.length === 1
        ? `"${spec.nombre}" copiado a ${elegidosReales[0].configNombre}`
        : `"${spec.nombre}" copiado a ${elegidosReales.length} diseños`,
    )
    onCerrar()
  }

  return (
    <Modal titulo={`Copiar "${spec.nombre}" a…`} onCerrar={onCerrar} ancho="max-w-2xl">
      {!destinos ? (
        <p className="text-sm text-neutral-400 text-center py-8 animate-pulse">Cargando…</p>
      ) : porProducto.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          No hay otros diseños donde copiarlo todavía.
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-3">
            Se copia el texto y las {imagenes.length}{' '}
            {imagenes.length === 1 ? 'imagen' : 'imágenes'} de este detalle.
          </p>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto">
            {porProducto.map(([pid, grupo]) => (
              <div key={pid}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {grupo.nombre}
                    {pid === spec.producto_id && (
                      <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
                        este producto
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => {
                      const todas = grupo.items.every((d) => elegidos.has(clave(d)))
                      setElegidos((prev) => {
                        const s = new Set(prev)
                        for (const d of grupo.items) {
                          todas ? s.delete(clave(d)) : s.add(clave(d))
                        }
                        return s
                      })
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-900"
                  >
                    todos
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {grupo.items.map((d) => {
                    const marcado = elegidos.has(clave(d))
                    return (
                      <button
                        key={clave(d)}
                        onClick={() => alternar(d)}
                        className={`flex items-center gap-2 p-2 rounded border text-left
                                    transition-colors ${marcado
                                      ? 'border-neutral-900 bg-neutral-50'
                                      : 'border-neutral-200 hover:border-neutral-400'}`}
                      >
                        <span className={`w-4 h-4 shrink-0 rounded border flex items-center
                                          justify-center ${marcado
                                            ? 'bg-neutral-900 border-neutral-900 text-white'
                                            : 'border-neutral-300'}`}>
                          {marcado && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="4">
                              <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {d.foto ? (
                          <img src={d.foto} alt="" className="w-9 h-9 rounded object-cover shrink-0 bg-neutral-100" />
                        ) : (
                          <span className="w-9 h-9 rounded bg-neutral-100 shrink-0" />
                        )}
                        <span className="text-sm truncate">{d.configNombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 mt-2 border-t border-neutral-200">
            <button onClick={onCerrar} className="btn flex-1">Cancelar</button>
            <button
              onClick={copiar}
              disabled={!elegidos.size || copiando}
              className="btn btn-negro flex-1"
            >
              {copiando ? 'Copiando…' : `Copiar a ${elegidos.size || ''}`.trim()}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
