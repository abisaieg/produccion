import { useId, useState } from 'react'
import { db } from '../lib/datos'
import { SPECS_SUGERIDAS, type Especificacion, type Foto } from '../lib/tipos'
import { BotonBorrar, CampoNuevo, CampoTexto } from './ui'
import { ElegirOpcion } from './ElegirOpcion'
import { CopiarDetalle } from './CopiarDetalle'
import { Imagenes } from './Imagenes'

/**
 * Los detalles del producto: packaging, insert, tela, etc.
 *
 * Cada uno lleva un texto y todas las imágenes que quieras, cada imagen con
 * su propio texto. También se puede traer de la biblioteca, que guarda las
 * opciones ya cargadas con su foto para reusarlas entre estilos.
 */
export function SeccionSpecs({
  productoId, configId = null, specs, fotos, titulo, sinCaja = false, onAviso,
}: {
  productoId: string
  /** null = detalles generales del producto; con valor = detalles de ese estilo */
  configId?: string | null
  specs: Especificacion[]
  /** todas las fotos del producto; acá se usan las que cuelgan de cada detalle */
  fotos: Foto[]
  titulo?: string
  sinCaja?: boolean
  onAviso?: (mensaje: string) => void
}) {
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
      </div>

      <div className="divide-y divide-neutral-100">
        {specs.map((s) => (
          <FilaSpec
            key={s.id}
            spec={s}
            productoId={productoId}
            configId={configId}
            fotos={fotos.filter((f) => f.spec_id === s.id)}
            onAviso={onAviso}
          />
        ))}

        {/* fila libre, siempre al final: elegís vos qué detalle agregar */}
        <FilaNueva sugerencias={sinUsar} onCrear={agregar} />
      </div>
    </section>
  )
}

/**
 * La última fila, vacía y siempre disponible. Se elige de la lista o se
 * escribe cualquier otro nombre; al confirmarlo se crea el detalle de
 * verdad y aparece una fila nueva debajo.
 */
function FilaNueva({ sugerencias, onCrear }: {
  sugerencias: string[]
  onCrear: (nombre: string) => void
}) {
  const listaId = useId()

  return (
    <div className="flex items-center gap-2 py-3">
      <div className="w-5 h-5 shrink-0 rounded border border-dashed border-neutral-300" />
      <div className="w-32 sm:w-40 shrink-0">
        <CampoNuevo
          placeholder="Otro detalle…"
          onCrear={onCrear}
          lista={listaId}
        />
      </div>
      <datalist id={listaId}>
        {sugerencias.map((s) => <option key={s} value={s} />)}
      </datalist>
      <p className="text-xs text-neutral-400 flex-1 min-w-0 truncate">
        Elegí uno de la lista o escribí el que quieras y apretá Enter.
      </p>
    </div>
  )
}

function FilaSpec({ spec, productoId, configId, fotos, onAviso }: {
  spec: Especificacion
  productoId: string
  configId: string | null
  fotos: Foto[]
  onAviso?: (mensaje: string) => void
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const set = (cambios: Record<string, unknown>) =>
    db.actualizar('especificaciones', spec.id, cambios)

  return (
    <>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => set({ definido: !spec.definido })}
            title={spec.definido
              ? 'Ya definido con la fábrica — tocá para desmarcar'
              : 'Marcar cuando quede definido con la fábrica'}
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
              multilinea
              filas={1}
            />
          </div>

          <button
            onClick={() => setCopiando(true)}
            title="Copiar este detalle a otros diseños o productos"
            className="text-xs text-neutral-400 hover:text-neutral-900 underline
                       whitespace-nowrap shrink-0"
          >
            copiar a…
          </button>

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

      {copiando && (
        <CopiarDetalle
          spec={spec}
          imagenes={fotos}
          configActual={configId}
          onCerrar={() => setCopiando(false)}
          onListo={(m) => onAviso?.(m)}
        />
      )}

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
