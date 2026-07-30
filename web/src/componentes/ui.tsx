import { useEffect, useRef, useState } from 'react'

/**
 * Lo que devuelve una escritura a la base. Los builders de Supabase son
 * "thenable" pero no Promise, por eso PromiseLike.
 */
export type Guardado = void | PromiseLike<unknown>

/**
 * Input que guarda solo, sin botón: espera a que dejes de escribir.
 *
 * Ojo con la sincronización: el valor de afuera solo pisa al local cuando
 * cambió de verdad en la base. Si dependiera del foco, al hacer click afuera
 * el valor viejo volvería a la pantalla antes de que termine el guardado y
 * parecería que se perdió lo escrito.
 */
export function CampoTexto({
  valor, onGuardar, placeholder, className = '', multilinea = false, filas = 3,
  tipo = 'text', autoFocus = false,
}: {
  valor: string | null
  onGuardar: (v: string | null) => Guardado
  placeholder?: string
  className?: string
  multilinea?: boolean
  filas?: number
  tipo?: 'text' | 'number'
  autoFocus?: boolean
}) {
  const [local, setLocal] = useState(valor ?? '')
  const [fallo, setFallo] = useState(false)
  const enfocado = useRef(false)
  const ultimoExterno = useRef(valor ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const v = valor ?? ''
    if (v === ultimoExterno.current) return // no cambió afuera: no tocar nada
    ultimoExterno.current = v
    if (enfocado.current) return // lo estás escribiendo: no te lo pisamos
    setLocal(v)
  }, [valor])

  useEffect(() => () => clearTimeout(timer.current), [])

  const guardar = async (texto: string) => {
    clearTimeout(timer.current)
    const limpio = texto.trim() === '' ? null : texto
    if ((limpio ?? '') === (valor ?? '')) return

    const r = await onGuardar(limpio) as { error?: unknown } | undefined
    if (r && typeof r === 'object' && 'error' in r && r.error) {
      // no se guardó: devolvemos el campo a lo último confirmado
      setFallo(true)
      setLocal(valor ?? '')
      setTimeout(() => setFallo(false), 2500)
    }
  }

  const props = {
    value: local,
    placeholder,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value
      setLocal(v)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => guardar(v), 600)
    },
    onFocus: () => { enfocado.current = true },
    onBlur: () => { enfocado.current = false; guardar(local) },
    className: `campo ${className} ${fallo ? 'border-red-500 bg-red-50' : ''}`,
  }

  return multilinea
    ? <textarea {...props} rows={filas} className={`${props.className} resize-y`} />
    : <input {...props} type={tipo} inputMode={tipo === 'number' ? 'decimal' : undefined} />
}

/**
 * Botón de borrar. Siempre visible (si se escondiera hasta pasar el mouse
 * por encima, en el celular no habría forma de borrar nada) y de un solo
 * click. Solo pregunta cuando borrar hace perder trabajo de verdad —pasar
 * `confirmar`—, porque el paso extra en cada ítem chico era pura fricción.
 */
export function BotonBorrar({ onBorrar, titulo = 'Borrar', className = '', confirmar }: {
  onBorrar: () => void
  titulo?: string
  className?: string
  /** Texto de la pregunta. Si no se pasa, borra directo. */
  confirmar?: string
}) {
  return (
    <button
      onClick={() => { if (!confirmar || window.confirm(confirmar)) onBorrar() }}
      title={titulo}
      className={`text-neutral-400 hover:text-white hover:bg-red-600 rounded
                  transition-colors p-2 shrink-0 ${className}`}
      aria-label={titulo}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/**
 * Campo para dar de alta algo nuevo. A diferencia de CampoTexto no guarda
 * mientras escribís: crea una sola vez, con Enter o al salir del campo.
 */
export function CampoNuevo({ placeholder, onCrear, autoFocus = false }: {
  placeholder: string
  onCrear: (texto: string) => void
  autoFocus?: boolean
}) {
  const [texto, setTexto] = useState('')
  const yaCreo = useRef(false)

  const crear = () => {
    const limpio = texto.trim()
    if (!limpio || yaCreo.current) return
    yaCreo.current = true
    onCrear(limpio)
    setTexto('')
    // permitir cargar otro enseguida
    setTimeout(() => { yaCreo.current = false }, 400)
  }

  return (
    <input
      value={texto}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear() } }}
      onBlur={crear}
      className="campo-caja text-sm"
    />
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

/**
 * Alta de varios de una: "1 plaza, 2 plazas, King" crea las tres.
 * Cargar de a uno con un botón cada vez era lentísimo.
 */
export function AltaRapida({ etiqueta, ejemplo, onCrear, onCerrar }: {
  etiqueta: string
  ejemplo: string
  onCrear: (nombres: string[]) => void | Promise<unknown>
  onCerrar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const nombres = texto
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)

  const crear = async () => {
    if (!nombres.length) return
    setGuardando(true)
    await onCrear(nombres)
    setGuardando(false)
    onCerrar()
  }

  return (
    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded mb-3">
      <label className="text-xs text-neutral-500 block mb-1">
        {etiqueta} — separados por coma
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); crear() }
            if (e.key === 'Escape') onCerrar()
          }}
          placeholder={ejemplo}
          className="campo-caja text-sm flex-1"
        />
        <div className="flex gap-2">
          <button onClick={onCerrar} className="btn flex-1 sm:flex-none">Cancelar</button>
          <button
            onClick={crear}
            disabled={!nombres.length || guardando}
            className="btn btn-negro flex-1 sm:flex-none whitespace-nowrap"
          >
            {guardando ? 'Creando…' : `Agregar ${nombres.length || ''}`.trim()}
          </button>
        </div>
      </div>
      {nombres.length > 1 && (
        <p className="text-xs text-neutral-500 mt-1.5">
          Se van a crear: {nombres.join(' · ')}
        </p>
      )}
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
