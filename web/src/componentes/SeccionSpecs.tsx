import { useState } from 'react'
import { db } from '../lib/datos'
import { SPECS_SUGERIDAS, type Especificacion } from '../lib/tipos'
import { borrarFoto } from '../lib/fotos'
import { BotonBorrar, CampoTexto, Vacio } from './ui'
import { Foto } from './Foto'

/**
 * Los "detalles variables" del producto: packaging, insert, bolsa, etc.
 * Cada uno con su valor y su foto de ejemplo, y un tilde para marcar
 * lo que ya quedó definido con la fábrica.
 */
export function SeccionSpecs({ productoId, configId = null, specs, titulo, sinCaja = false }: {
  productoId: string
  /** null = detalles generales del producto; con valor = detalles de esa configuración */
  configId?: string | null
  specs: Especificacion[]
  titulo?: string
  sinCaja?: boolean
}) {
  const [agregando, setAgregando] = useState(false)

  const agregar = async (nombre: string) => {
    await db.agregar('especificaciones', {
      producto_id: productoId,
      config_id: configId,
      nombre,
      orden: specs.length,
    })
    setAgregando(false)
  }

  const sinUsar = SPECS_SUGERIDAS.filter(
    (s) => !specs.some((e) => e.nombre.toLowerCase() === s.toLowerCase()),
  )
  const definidas = specs.filter((s) => s.definido).length

  return (
    <section className={sinCaja ? '' : 'tarjeta p-4'}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="titulo-seccion">
          {titulo ?? 'Detalles del producto'}
          {specs.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {definidas} de {specs.length} definidos
            </span>
          )}
        </h3>
        <button onClick={() => setAgregando(!agregando)} className="btn btn-chico">
          + Agregar detalle
        </button>
      </div>

      {agregando && (
        <div className="mb-4 p-3 bg-neutral-50 rounded border border-neutral-200">
          <CampoTexto
            valor={null}
            autoFocus
            placeholder="Nombre del detalle (ej: Tipo de cierre) y Enter"
            className="campo-caja mb-2"
            onGuardar={(v) => { if (v) agregar(v) }}
          />
          {sinUsar.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sinUsar.map((s) => (
                <button
                  key={s}
                  onClick={() => agregar(s)}
                  className="text-xs px-2 py-1 rounded-full border border-neutral-300
                             bg-white hover:bg-neutral-900 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {specs.length === 0 && !agregando ? (
        <Vacio
          texto="Todavía no cargaste ningún detalle."
          accion={
            <button onClick={() => setAgregando(true)} className="btn btn-chico">
              Empezar con los detalles típicos
            </button>
          }
        />
      ) : (
        <div className="divide-y divide-neutral-100">
          {specs.map((s) => (
            <FilaSpec key={s.id} spec={s} />
          ))}
        </div>
      )}
    </section>
  )
}

function FilaSpec({ spec }: { spec: Especificacion }) {
  const set = (cambios: Record<string, unknown>) =>
    db.actualizar('especificaciones', spec.id, cambios)

  return (
    <div className="flex gap-3 py-2.5 items-start group">
      <button
        onClick={() => set({ definido: !spec.definido })}
        title={spec.definido ? 'Definido' : 'Marcar como definido'}
        className={`mt-1.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center
                    transition-colors ${spec.definido
                      ? 'bg-neutral-900 border-neutral-900 text-white'
                      : 'border-neutral-300 hover:border-neutral-500'}`}
      >
        {spec.definido && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="w-36 sm:w-44 shrink-0">
        <CampoTexto
          valor={spec.nombre}
          onGuardar={(v) => set({ nombre: v ?? 'Sin nombre' })}
          className={`text-sm font-medium ${spec.definido ? '' : 'text-neutral-900'}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <CampoTexto
          valor={spec.valor}
          onGuardar={(v) => set({ valor: v })}
          placeholder="Describilo… (ej: bolsa PVC con cierre, logo 2 colores)"
          className="text-sm"
          multilinea
          filas={1}
        />
      </div>

      <Foto
        url={spec.foto}
        tamaño="sm"
        carpeta="specs"
        etiqueta="Ej."
        onCambio={(url) => {
          if (!url && spec.foto) borrarFoto(spec.foto)
          set({ foto: url })
        }}
      />

      <BotonBorrar
        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
        onBorrar={() => {
          if (spec.foto) borrarFoto(spec.foto)
          db.borrar('especificaciones', spec.id)
        }}
      />
    </div>
  )
}
