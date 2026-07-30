import { useState } from 'react'
import { db } from '../lib/datos'
import { SPECS_SUGERIDAS, type Especificacion, type Foto } from '../lib/tipos'
import { BotonBorrar, CampoNuevo, CampoTexto } from './ui'
import { ElegirOpcion } from './ElegirOpcion'
import { Imagenes } from './Imagenes'

/**
 * Los detalles del producto: packaging, insert, tela, etc.
 *
 * Cada uno lleva un texto y todas las imágenes que quieras, cada imagen con
 * su propio texto. También se puede traer de la biblioteca, que guarda las
 * opciones ya cargadas con su foto para reusarlas entre estilos.
 */
export function SeccionSpecs({
  productoId, configId = null, specs, fotos, titulo, sinCaja = false,
}: {
  productoId: string
  /** null = detalles generales del producto; con valor = detalles de ese estilo */
  configId?: string | null
  specs: Especificacion[]
  /** todas las fotos del producto; acá se usan las que cuelgan de cada detalle */
  fotos: Foto[]
  titulo?: string
  sinCaja?: boolean
}) {
  const [agregando, setAgregando] = useState(specs.length === 0)

  // el panel queda abierto: normalmente se cargan varios detalles seguidos
  const agregar = (nombre: string) =>
    db.agregar('especificaciones', {
      producto_id: productoId,
      config_id: configId,
      nombre,
      orden: specs.length,
    })

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
        {specs.length > 0 && (
          <button onClick={() => setAgregando(!agregando)} className="btn btn-chico shrink-0">
            {agregando ? 'Listo' : '+ Detalle'}
          </button>
        )}
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

      <div className="divide-y divide-neutral-100">
        {specs.map((s) => (
          <FilaSpec
            key={s.id}
            spec={s}
            productoId={productoId}
            configId={configId}
            fotos={fotos.filter((f) => f.spec_id === s.id)}
          />
        ))}
      </div>
    </section>
  )
}

function FilaSpec({ spec, productoId, configId, fotos }: {
  spec: Especificacion
  productoId: string
  configId: string | null
  fotos: Foto[]
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const set = (cambios: Record<string, unknown>) =>
    db.actualizar('especificaciones', spec.id, cambios)

  return (
    <>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => set({ definido: !spec.definido })}
            title={spec.definido ? 'Definido' : 'Marcar como definido'}
            className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center
                        transition-colors ${spec.definido
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'border-neutral-300 hover:border-neutral-500'}`}
          >
            {spec.definido && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="4">
                <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="w-32 sm:w-40 shrink-0">
            <CampoTexto
              valor={spec.nombre}
              onGuardar={(v) => set({ nombre: v ?? 'Sin nombre' })}
              className="text-sm font-medium"
            />
          </div>

          <div className="flex-1 min-w-0">
            <CampoTexto
              valor={spec.valor}
              onGuardar={(v) => set({ valor: v })}
              placeholder={`Describí el ${spec.nombre.toLowerCase()}…`}
              className="text-sm"
            />
          </div>

          <button
            onClick={() => setEligiendo(true)}
            title="Traer de la biblioteca"
            className="text-xs text-neutral-400 hover:text-neutral-900 underline
                       whitespace-nowrap shrink-0 hidden sm:block"
          >
            biblioteca
          </button>

          <BotonBorrar onBorrar={() => db.borrar('especificaciones', spec.id)} />
        </div>

        {/* todas las imágenes que quieras, cada una con su texto */}
        <div className="pl-7">
          <Imagenes
            productoId={productoId}
            configId={configId}
            specId={spec.id}
            fotos={fotos}
            tamaño="sm"
            etiquetaVacio="Foto"
          />
          <button
            onClick={() => setEligiendo(true)}
            className="text-xs text-neutral-400 hover:text-neutral-900 underline mt-1 sm:hidden"
          >
            traer de la biblioteca
          </button>
        </div>
      </div>

      {eligiendo && (
        <ElegirOpcion
          tipo={spec.nombre}
          specId={spec.id}
          productoId={productoId}
          configId={configId}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </>
  )
}
