import { useState } from 'react'
import { comoDetalle, crearOpcion, useBiblioteca } from '../lib/biblioteca'
import type { Opcion } from '../lib/tipos'
import { db } from '../lib/datos'
import { Modal } from './ui'
import { Foto } from './Foto'

/**
 * Elegir de la biblioteca en vez de escribir.
 *
 * Ejemplo: cuatro estilos de acolchado, cada uno con su packaging. El
 * packaging se carga una sola vez con su foto y después se elige con un
 * click en cada estilo.
 */
export function ElegirOpcion({ tipo, specId, onCerrar }: {
  tipo: string
  /** el detalle del producto que se va a completar con la opción elegida */
  specId: string
  onCerrar: () => void
}) {
  const { opciones, cargando, recargar } = useBiblioteca(tipo)
  const [creando, setCreando] = useState(false)

  const elegir = async (op: Opcion) => {
    await db.actualizar('especificaciones', specId, { ...comoDetalle(op), definido: true })
    onCerrar()
  }

  return (
    <Modal titulo={`Elegir ${tipo.toLowerCase()}`} onCerrar={onCerrar} ancho="max-w-2xl">
      {creando ? (
        <NuevaOpcion
          tipo={tipo}
          onListo={async (op) => {
            await recargar()
            setCreando(false)
            if (op) elegir(op)
          }}
          onCancelar={() => setCreando(false)}
        />
      ) : (
        <>
          <button
            onClick={() => setCreando(true)}
            className="btn btn-negro w-full mb-4"
          >
            + Cargar {tipo.toLowerCase()} nuevo
          </button>

          {cargando ? (
            <p className="text-sm text-neutral-400 text-center py-8 animate-pulse">Cargando…</p>
          ) : opciones.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">
              Todavía no cargaste ningún {tipo.toLowerCase()}.<br />
              El primero que cargues queda guardado para reusarlo en los demás estilos.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {opciones.map((op) => (
                <button
                  key={op.id}
                  onClick={() => elegir(op)}
                  className="text-left border border-neutral-200 rounded-lg overflow-hidden
                             hover:border-neutral-900 transition-colors group"
                >
                  <div className="aspect-square bg-neutral-100 relative">
                    {op.foto ? (
                      <img src={op.foto} alt={op.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`¿Sacar "${op.nombre}" de la biblioteca?`)) {
                          db.borrar('opciones', op.id).then(recargar)
                        }
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white
                                 text-sm leading-none flex items-center justify-center
                                 hover:bg-red-600"
                      title="Sacar de la biblioteca"
                    >
                      ×
                    </span>
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-medium leading-tight">{op.nombre}</div>
                    {op.detalle && (
                      <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{op.detalle}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

function NuevaOpcion({ tipo, onListo, onCancelar }: {
  tipo: string
  onListo: (op: Opcion | null) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [detalle, setDetalle] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    const op = await crearOpcion({ tipo, nombre: nombre.trim(), detalle: detalle.trim() || null, foto })
    setGuardando(false)
    onListo(op)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Foto url={foto} onCambio={setFoto} tamaño="md" carpeta="biblioteca" etiqueta="Foto" />
        <div className="flex-1 space-y-2">
          <div>
            <label className="text-xs text-neutral-500">Nombre</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
              placeholder={`ej: ${ejemploDe(tipo)}`}
              className="campo-caja text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Detalle (opcional)</label>
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
              placeholder="medidas, material, impresión…"
              className="campo-caja text-sm"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Queda guardado en la biblioteca: lo vas a poder elegir en los demás estilos
        y en otros productos sin volver a cargarlo.
      </p>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancelar} className="btn flex-1">Cancelar</button>
        <button
          onClick={guardar}
          disabled={!nombre.trim() || guardando}
          className="btn btn-negro flex-1"
        >
          {guardando ? 'Guardando…' : 'Guardar y elegir'}
        </button>
      </div>
    </div>
  )
}

function ejemploDe(tipo: string) {
  const t = tipo.toLowerCase()
  if (t.includes('packaging')) return 'Bolsa PVC con cierre'
  if (t.includes('insert')) return 'Insert de cartón impreso'
  if (t.includes('bolsa')) return 'Polybag transparente'
  if (t.includes('tela')) return 'Microfibra 140 g'
  if (t.includes('etiqueta')) return 'Etiqueta tejida con logo'
  if (t.includes('relleno')) return 'Vellón siliconado 200 g'
  return 'nombre de la opción'
}
