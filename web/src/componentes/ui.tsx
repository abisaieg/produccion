import { useEffect, useRef, useState } from 'react'

/**
 * Input que guarda solo, sin botón: espera a que dejes de escribir.
 * Si otra persona edita el mismo campo desde otra compu, el valor de afuera
 * pisa al local únicamente cuando no lo estás tocando.
 */
export function CampoTexto({
  valor, onGuardar, placeholder, className = '', multilinea = false, filas = 3,
  tipo = 'text', autoFocus = false,
}: {
  valor: string | null
  onGuardar: (v: string | null) => void
  placeholder?: string
  className?: string
  multilinea?: boolean
  filas?: number
  tipo?: 'text' | 'number'
  autoFocus?: boolean
}) {
  const [local, setLocal] = useState(valor ?? '')
  const [enfocado, setEnfocado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!enfocado) setLocal(valor ?? '')
  }, [valor, enfocado])

  const cambiar = (v: string) => {
    setLocal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onGuardar(v.trim() === '' ? null : v), 600)
  }

  const salir = () => {
    setEnfocado(false)
    clearTimeout(timer.current)
    const limpio = local.trim() === '' ? null : local
    if (limpio !== valor) onGuardar(limpio)
  }

  const props = {
    value: local,
    placeholder,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambiar(e.target.value),
    onFocus: () => setEnfocado(true),
    onBlur: salir,
    className: `campo ${className}`,
  }

  return multilinea
    ? <textarea {...props} rows={filas} className={`${props.className} resize-y`} />
    : <input {...props} type={tipo} inputMode={tipo === 'number' ? 'decimal' : undefined} />
}

/** Botón de borrar discreto, pide confirmación. */
export function BotonBorrar({ onBorrar, titulo = 'Borrar', className = '' }: {
  onBorrar: () => void
  titulo?: string
  className?: string
}) {
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!confirmando) return
    const t = setTimeout(() => setConfirmando(false), 3000)
    return () => clearTimeout(t)
  }, [confirmando])

  if (confirmando) {
    return (
      <button
        onClick={() => { onBorrar(); setConfirmando(false) }}
        className="text-xs px-2 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700"
      >
        ¿Seguro?
      </button>
    )
  }
  return (
    <button
      onClick={() => setConfirmando(true)}
      title={titulo}
      className={`text-neutral-400 hover:text-red-600 transition-colors px-1.5 py-1 ${className}`}
      aria-label={titulo}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-neutral-400 text-sm">
      <div className="animate-pulse">{texto}</div>
    </div>
  )
}

export function Vacio({ texto, accion }: { texto: string; accion?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm text-neutral-400">{texto}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  )
}

/** Cartelito flotante de aviso. */
export function Aviso({ mensaje, onCerrar }: { mensaje: string; onCerrar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, 4000)
    return () => clearTimeout(t)
  }, [onCerrar])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white
                    text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-[90vw] text-center">
      {mensaje}
    </div>
  )
}

/** Modal simple. */
export function Modal({ titulo, onCerrar, children, ancho = 'max-w-lg' }: {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
  ancho?: string
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className={`bg-white w-full ${ancho} rounded-t-2xl sm:rounded-lg shadow-xl
                    max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3
                        flex items-center justify-between z-10">
          <h2 className="font-semibold">{titulo}</h2>
          <button onClick={onCerrar} className="text-neutral-400 hover:text-neutral-900 text-xl leading-none px-1">
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
