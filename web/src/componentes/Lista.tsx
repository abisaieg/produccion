import { useMemo, useState } from 'react'
import { db, useProductos } from '../lib/datos'
import { ESTADOS, estadoInfo, type Producto } from '../lib/tipos'
import { Cargando } from './ui'

/** Pantalla principal: todos los productos, en qué anda cada uno y qué falta. */
export function Lista({ onAbrir, onExportar }: {
  onAbrir: (id: string) => void
  onExportar: (ids: string[]) => void
}) {
  const { productos, cargando } = useProductos()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => {
      if (p.archivado !== verArchivados) return false
      if (filtroEstado && p.estado !== filtroEstado) return false
      if (!q) return true
      return [p.nombre, p.codigo, p.proveedor, p.categoria, p.pendiente]
        .some((c) => c?.toLowerCase().includes(q))
    })
  }, [productos, busqueda, filtroEstado, verArchivados])

  const activos = productos.filter((p) => !p.archivado)
  const porEstado = (e: string) => activos.filter((p) => p.estado === e).length

  const alternar = (id: string) => {
    setElegidos((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const crear = async () => {
    const { data } = await db.crearProducto({ nombre: 'Producto nuevo', estado: 'idea' })
    if (data) onAbrir(data.id as string)
  }

  if (cargando) return <Cargando />

  return (
    <div className="max-w-5xl mx-auto px-4 pb-32">
      {/* encabezado */}
      <div className="flex items-center justify-between py-4 gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {activos.length} {activos.length === 1 ? 'producto' : 'productos'} en curso
          </p>
        </div>
        <button onClick={crear} className="btn btn-negro">+ Nuevo producto</button>
      </div>

      {/* buscador y filtros */}
      <div className="space-y-2 mb-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código, proveedor…"
          className="campo-caja text-sm"
        />
        <div className="flex gap-1.5 flex-wrap items-center">
          <Filtro activo={!filtroEstado} onClick={() => setFiltroEstado(null)}>
            Todos <span className="opacity-50">{activos.length}</span>
          </Filtro>
          {ESTADOS.map((e) => {
            const n = porEstado(e.valor)
            if (!n && filtroEstado !== e.valor) return null
            return (
              <Filtro
                key={e.valor}
                activo={filtroEstado === e.valor}
                onClick={() => setFiltroEstado(filtroEstado === e.valor ? null : e.valor)}
              >
                {e.texto} <span className="opacity-50">{n}</span>
              </Filtro>
            )
          })}
          <div className="flex-1" />
          <button
            onClick={() => { setVerArchivados(!verArchivados); setElegidos(new Set()) }}
            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors px-2"
          >
            {verArchivados ? '← Volver a los activos' : 'Ver archivados'}
          </button>
        </div>
      </div>

      {/* listado */}
      {visibles.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-400 text-sm mb-4">
            {busqueda || filtroEstado
              ? 'Ningún producto coincide con la búsqueda.'
              : verArchivados
                ? 'No hay productos archivados.'
                : 'Todavía no cargaste ningún producto.'}
          </p>
          {!busqueda && !filtroEstado && !verArchivados && (
            <button onClick={crear} className="btn btn-negro">Cargar el primero</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map((p) => (
            <FilaProducto
              key={p.id}
              producto={p}
              elegido={elegidos.has(p.id)}
              onElegir={() => alternar(p.id)}
              onAbrir={() => onAbrir(p.id)}
            />
          ))}
        </div>
      )}

      {/* barra de seleccionados */}
      {elegidos.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-neutral-900 text-white
                        px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-sm">
            {elegidos.size} {elegidos.size === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <button
            onClick={() => setElegidos(new Set())}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            limpiar
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onExportar([...elegidos])}
            className="btn bg-white text-neutral-900 border-white hover:bg-neutral-200"
          >
            Descargar Excel
          </button>
        </div>
      )}
    </div>
  )
}

function Filtro({ activo, onClick, children }: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                  ${activo
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
    >
      {children}
    </button>
  )
}

function FilaProducto({ producto: p, elegido, onElegir, onAbrir }: {
  producto: Producto
  elegido: boolean
  onElegir: () => void
  onAbrir: () => void
}) {
  const est = estadoInfo(p.estado)

  return (
    <div className={`tarjeta flex items-center gap-3 p-3 transition-all cursor-pointer
                     hover:border-neutral-400 ${elegido ? 'ring-2 ring-neutral-900 border-neutral-900' : ''}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onElegir() }}
        className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center transition-colors
                    ${elegido
                      ? 'bg-neutral-900 border-neutral-900 text-white'
                      : 'border-neutral-300 hover:border-neutral-500'}`}
        title="Seleccionar para exportar"
      >
        {elegido && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div onClick={onAbrir} className="flex items-center gap-3 flex-1 min-w-0">
        {p.foto ? (
          <img src={p.foto} alt="" className="w-12 h-12 rounded object-cover bg-neutral-100 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded bg-neutral-100 shrink-0 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" className="text-neutral-300">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{p.nombre}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${est.clase}`}>
              {est.texto}
            </span>
          </div>
          <div className="text-xs text-neutral-500 truncate mt-0.5">
            {[p.codigo, p.proveedor, p.categoria].filter(Boolean).join(' · ') || 'Sin datos todavía'}
          </div>
          {p.pendiente && (
            <div className="text-xs text-amber-700 truncate mt-0.5">
              Falta: {p.pendiente}
            </div>
          )}
        </div>

        <span className="text-[11px] text-neutral-400 shrink-0 hidden sm:block">
          {new Date(p.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
