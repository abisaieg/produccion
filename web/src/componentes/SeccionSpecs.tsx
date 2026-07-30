import { useState } from 'react'
import { db } from '../lib/datos'
import { SPECS_SUGERIDAS, type Especificacion } from '../lib/tipos'
import { borrarFoto } from '../lib/fotos'
import { BotonBorrar, CampoNuevo, CampoTexto, Vacio } from './ui'
import { Foto } from './Foto'
import { ElegirOpcion } from './ElegirOpcion'

/**
 * Los detalles del producto: packaging, insert, tela, etc.
 *
 * Cada uno se puede elegir de la biblioteca (con su foto ya cargada) o
 * escribir a mano si es algo puntual.
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

  // el panel queda abierto: normalmente se cargan varios detalles seguidos
  const agregar = async (nombre: string) => {
    await db.agregar('especificaciones', {
      producto_id: productoId,
      config_id: configId,
      nombre,
      orden: specs.length,
    })
  }

  const sinUsar = SPECS_SUGERIDAS.filter(
    (s) => !specs.some((e) => e.nombre.toLowerCase() === s.toLowerCase()),
  )
  const definidas = specs.filter((s) => s.definido).length

  return (
    <section className={sinCaja ? '' : 'tarjeta p-4'}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="titulo-seccion">
          {titulo ?? 'Detalles del producto'}
          {specs.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {definidas} de {specs.length} definidos
            </span>
          )}
        </h3>
        <button onClick={() => setAgregando(!agregando)} className="btn btn-chico shrink-0">
          {agregando ? 'Listo' : '+ Detalle'}
        </button>
      </div>

      {agregando && (
        <div className="mb-4 p-3 bg-neutral-50 rounded border border-neutral-200">
          <p className="text-xs text-neutral-500 mb-2">
            Tocá uno para agregarlo, o escribí otro nombre.
          </p>
          {sinUsar.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sinUsar.map((s) => (
                <button
                  key={s}
                  onClick={() => agregar(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-neutral-300
                             bg-white hover:bg-neutral-900 hover:text-white transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
          <CampoNuevo
            placeholder="Otro detalle (ej: Tipo de cierre) y Enter"
            onCrear={agregar}
          />
        </div>
      )}

      {specs.length === 0 && !agregando ? (
        <Vacio
          texto="Todavía no cargaste ningún detalle."
          accion={
            <button onClick={() => setAgregando(true)} className="btn btn-chico">
              Agregar los detalles típicos
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
  const [eligiendo, setEligiendo] = useState(false)
  const set = (cambios: Record<string, unknown>) =>
    db.actualizar('especificaciones', spec.id, cambios)

  const borrar = () => {
    if (spec.foto && !spec.opcion_id) borrarFoto(spec.foto)
    db.borrar('especificaciones', spec.id)
  }

  const tilde = (
    <button
      onClick={() => set({ definido: !spec.definido })}
      title={spec.definido ? 'Definido' : 'Marcar como definido'}
      className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center
                  transition-colors ${spec.definido
                    ? 'bg-neutral-900 border-neutral-900 text-white'
                    : 'border-neutral-300 hover:border-neutral-500'}`}
    >
      {spec.definido && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
          <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )

  /** Miniatura de la opción elegida, o el cuadro para subir una foto suelta. */
  const imagen = spec.opcion_id && spec.foto ? (
    <img
      src={spec.foto}
      alt=""
      onClick={() => setEligiendo(true)}
      className="w-16 h-16 shrink-0 rounded object-cover border border-neutral-200 cursor-pointer"
      title="Cambiar"
    />
  ) : (
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
  )

  /** El valor: botón para elegir de la biblioteca, o texto libre si ya hay algo escrito. */
  const cuerpo = spec.valor ? (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <CampoTexto
          valor={spec.valor}
          onGuardar={(v) => set({ valor: v })}
          placeholder="Describilo…"
          className="text-sm"
          multilinea
          filas={1}
        />
      </div>
      <button
        onClick={() => setEligiendo(true)}
        className="text-xs text-neutral-400 hover:text-neutral-900 underline
                   whitespace-nowrap shrink-0 pt-2"
      >
        cambiar
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEligiendo(true)}
      className="w-full text-left text-sm text-neutral-400 border border-dashed
                 border-neutral-300 rounded px-3 py-2 hover:border-neutral-900
                 hover:text-neutral-900 transition-colors"
    >
      Elegir {spec.nombre.toLowerCase()}…
    </button>
  )

  return (
    <>
      <div className="py-3">
        {/* celular: nombre arriba, valor y foto abajo */}
        <div className="flex sm:hidden items-center gap-2 mb-1.5">
          {tilde}
          <CampoTexto
            valor={spec.nombre}
            onGuardar={(v) => set({ nombre: v ?? 'Sin nombre' })}
            className="text-sm font-medium flex-1 min-w-0"
          />
          <BotonBorrar onBorrar={borrar} />
        </div>
        <div className="flex sm:hidden gap-2 items-start pl-7">
          <div className="flex-1 min-w-0">{cuerpo}</div>
          {imagen}
        </div>

        {/* pantalla grande: todo en una línea */}
        <div className="hidden sm:flex gap-3 items-start">
          <div className="pt-1.5">{tilde}</div>
          <div className="w-40 shrink-0">
            <CampoTexto
              valor={spec.nombre}
              onGuardar={(v) => set({ nombre: v ?? 'Sin nombre' })}
              className="text-sm font-medium"
            />
          </div>
          <div className="flex-1 min-w-0">{cuerpo}</div>
          {imagen}
          <BotonBorrar className="mt-1" onBorrar={borrar} />
        </div>
      </div>

      {eligiendo && (
        <ElegirOpcion
          tipo={spec.nombre}
          specId={spec.id}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </>
  )
}
