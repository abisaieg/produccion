import { useRef, useState } from 'react'
import { db } from '../lib/datos'
import type { Foto as TFoto } from '../lib/tipos'
import { borrarFoto, subirFoto } from '../lib/fotos'
import { CampoTexto } from './ui'

/** Fotos de ejemplo del producto: referencias, muestras, lo que mandó la fábrica. */
export function SeccionGaleria({ productoId, configId, fotos }: {
  productoId: string
  configId: string
  fotos: TFoto[]
}) {
  const [subiendo, setSubiendo] = useState(0)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function subirVarias(files: FileList | null) {
    if (!files?.length) return
    const lista = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setSubiendo(lista.length)
    let orden = fotos.length
    for (const f of lista) {
      try {
        const url = await subirFoto(f, 'galeria')
        await db.agregar('fotos', {
          producto_id: productoId, config_id: configId, url, orden: orden++,
        })
      } catch {
        // si una falla seguimos con las demás
      }
      setSubiendo((n) => n - 1)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="titulo-seccion">
          Fotos de ejemplo
          {fotos.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {fotos.length}
            </span>
          )}
        </h3>
        <button onClick={() => input.current?.click()} className="btn btn-chico">
          + Subir fotos
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { subirVarias(e.target.files); e.target.value = '' }}
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); subirVarias(e.dataTransfer.files) }}
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        {fotos.map((f) => (
          <div key={f.id} className="group">
            <div className="relative aspect-square">
              <img
                src={f.url}
                alt={f.titulo ?? ''}
                onClick={() => setAmpliada(f.url)}
                className="w-full h-full object-cover rounded border border-neutral-200
                           cursor-zoom-in bg-neutral-100"
              />
              <button
                onClick={() => { borrarFoto(f.url); db.borrar('fotos', f.id) }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white
                           text-xs leading-none opacity-0 group-hover:opacity-100
                           transition-opacity flex items-center justify-center"
                title="Borrar foto"
              >
                ×
              </button>
            </div>
            <CampoTexto
              valor={f.titulo}
              onGuardar={(v) => db.actualizar('fotos', f.id, { titulo: v })}
              placeholder="Descripción…"
              className="text-xs text-neutral-500 mt-0.5"
            />
          </div>
        ))}

        {Array.from({ length: subiendo }).map((_, i) => (
          <div key={`sub-${i}`}
               className="aspect-square rounded border border-dashed border-neutral-300
                          flex items-center justify-center">
            <span className="text-[10px] text-neutral-400 animate-pulse">Subiendo…</span>
          </div>
        ))}

        {fotos.length === 0 && subiendo === 0 && (
          <button
            onClick={() => input.current?.click()}
            className="aspect-square rounded border-2 border-dashed border-neutral-300
                       hover:border-neutral-400 flex flex-col items-center justify-center
                       text-neutral-400 transition-colors"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] mt-1">Arrastrá o tocá</span>
          </button>
        )}
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </section>
  )
}
