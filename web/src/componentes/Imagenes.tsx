import { useRef, useState } from 'react'
import { db } from '../lib/datos'
import type { Foto as TFoto } from '../lib/tipos'
import { borrarFoto, subirFoto } from '../lib/fotos'
import { CampoTexto } from './ui'

/**
 * Varias imágenes, cada una con su texto. Se usa tanto para las imágenes de
 * un detalle (packaging, insert…) como para la galería del estilo.
 * Se pueden subir de a varias, arrastrar o pegar.
 */
export function Imagenes({ productoId, configId, specId, fotos, tamaño = 'md', etiquetaVacio }: {
  productoId: string
  configId?: string | null
  /** si viene, las fotos son de ese detalle */
  specId?: string | null
  fotos: TFoto[]
  tamaño?: 'sm' | 'md'
  etiquetaVacio?: string
}) {
  const [subiendo, setSubiendo] = useState(0)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // anchos generosos: el texto de cada imagen tiene que leerse entero
  const medida = tamaño === 'sm' ? 'w-28' : 'w-36'

  async function subirVarias(files: FileList | null) {
    if (!files?.length) return
    const lista = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!lista.length) return
    setSubiendo(lista.length)
    let orden = fotos.length
    for (const f of lista) {
      try {
        const url = await subirFoto(f, specId ? 'detalles' : 'galeria')
        await db.agregar('fotos', {
          producto_id: productoId,
          config_id: configId ?? null,
          spec_id: specId ?? null,
          url,
          orden: orden++,
        })
      } catch {
        // si una falla seguimos con las demás
      }
      setSubiendo((n) => n - 1)
    }
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); subirVarias(e.dataTransfer.files) }}
      onPaste={(e) => subirVarias(e.clipboardData.files)}
      className="flex flex-wrap gap-2 items-start"
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { subirVarias(e.target.files); e.target.value = '' }}
      />

      {fotos.map((f) => (
        <div key={f.id} className={`${medida} shrink-0`}>
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
                         text-xs leading-none flex items-center justify-center hover:bg-red-600"
              title="Borrar imagen"
            >
              ×
            </button>
          </div>
          {/* multilínea: el texto se lee entero, no cortado por el ancho */}
          <CampoTexto
            valor={f.titulo}
            onGuardar={(v) => db.actualizar('fotos', f.id, { titulo: v })}
            placeholder="Texto de esta foto…"
            className="text-[11px] text-neutral-600 mt-0.5 px-1 leading-snug"
            multilinea
            filas={2}
          />
        </div>
      ))}

      {Array.from({ length: subiendo }).map((_, i) => (
        <div key={`sub-${i}`}
             className={`${medida} shrink-0 aspect-square rounded border border-dashed
                         border-neutral-300 flex items-center justify-center`}>
          <span className="text-[10px] text-neutral-400 animate-pulse">Subiendo…</span>
        </div>
      ))}

      <button
        onClick={() => input.current?.click()}
        className={`${medida} shrink-0 aspect-square rounded border-2 border-dashed
                    border-neutral-300 hover:border-neutral-900 hover:text-neutral-900
                    flex flex-col items-center justify-center text-neutral-400
                    transition-colors px-1 text-center`}
      >
        <span className="text-xl leading-none">+</span>
        <span className="text-[10px] mt-1 leading-tight">
          {fotos.length ? 'Otra' : (etiquetaVacio ?? 'Imagen')}
        </span>
      </button>

      {ampliada && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  )
}
