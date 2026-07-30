import { useState } from 'react'
import { db } from '../lib/datos'
import type { Nota } from '../lib/tipos'
import { BotonBorrar } from './ui'

function cuandoFue(iso: string) {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/** Bitácora del producto: lo que se habló, lo que quedó pendiente. */
export function SeccionNotas({ productoId, notas }: {
  productoId: string
  notas: Nota[]
}) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const agregar = async () => {
    const limpio = texto.trim()
    if (!limpio) return
    setGuardando(true)
    await db.agregar('notas', { producto_id: productoId, texto: limpio })
    setTexto('')
    setGuardando(false)
  }

  return (
    <section className="tarjeta p-4">
      <h3 className="titulo-seccion mb-3">Notas</h3>

      <div className="flex gap-2 mb-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); agregar() }
          }}
          rows={2}
          placeholder="Escribí una nota… (⌘+Enter para guardar)"
          className="campo-caja resize-y text-sm flex-1"
        />
        <button
          onClick={agregar}
          disabled={!texto.trim() || guardando}
          className="btn btn-negro self-end"
        >
          Guardar
        </button>
      </div>

      {notas.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-4">
          Sin notas todavía.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notas.map((n) => (
            <li key={n.id} className="group flex gap-3 text-sm">
              <span className="text-xs text-neutral-400 shrink-0 w-20 pt-0.5 tabular-nums">
                {cuandoFue(n.created_at)}
              </span>
              <p className="flex-1 whitespace-pre-wrap break-words">{n.texto}</p>
              <BotonBorrar
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onBorrar={() => db.borrar('notas', n.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
