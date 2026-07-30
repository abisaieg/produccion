import { useRef, useState } from 'react'
import { subirFoto } from '../lib/fotos'

/**
 * Cuadro de foto: si está vacío invita a subir, si tiene imagen la muestra.
 * Acepta click, arrastrar y soltar, y pegar desde el portapapeles.
 */
export function Foto({
  url, onCambio, tamaño = 'md', carpeta = 'productos', etiqueta = 'Foto',
}: {
  url: string | null
  onCambio: (url: string | null) => void
  tamaño?: 'sm' | 'md' | 'lg'
  carpeta?: string
  etiqueta?: string
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [encima, setEncima] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const medidas = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28',
    lg: 'w-full aspect-square',
  }[tamaño]

  async function manejar(file: File | undefined | null) {
    if (!file || !file.type.startsWith('image/')) return
    setSubiendo(true)
    setError(null)
    try {
      onCambio(await subirFoto(file, carpeta))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setSubiendo(false)
    }
  }

  if (url) {
    return (
      <>
        <div className={`${medidas} relative group shrink-0`}>
          <img
            src={url}
            alt={etiqueta}
            onClick={() => setAmpliada(true)}
            className="w-full h-full object-cover rounded border border-neutral-200 cursor-zoom-in bg-neutral-100"
          />
          <button
            onClick={(e) => { e.stopPropagation(); onCambio(null) }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 text-white
                       text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity
                       flex items-center justify-center shadow"
            title="Quitar foto"
          >
            ×
          </button>
        </div>
        {ampliada && (
          <div
            className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
            onClick={() => setAmpliada(false)}
          >
            <img src={url} alt={etiqueta} className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </>
    )
  }

  return (
    <div
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setEncima(true) }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault()
        setEncima(false)
        manejar(e.dataTransfer.files?.[0])
      }}
      onPaste={(e) => manejar(e.clipboardData.files?.[0])}
      tabIndex={0}
      className={`${medidas} shrink-0 border-2 border-dashed rounded flex flex-col items-center
                  justify-center cursor-pointer transition-colors text-center px-1
                  ${encima ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 hover:border-neutral-400'}
                  ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}
      title="Subir foto"
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => manejar(e.target.files?.[0])}
      />
      {subiendo ? (
        <span className="text-[10px] text-neutral-500 animate-pulse">Subiendo…</span>
      ) : error ? (
        <span className="text-[10px] text-red-600 leading-tight">{error}</span>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" className="text-neutral-400">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          {tamaño !== 'sm' && (
            <span className="text-[10px] text-neutral-400 mt-1 leading-tight">{etiqueta}</span>
          )}
        </>
      )}
    </div>
  )
}
