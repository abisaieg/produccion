import { useEffect, useState } from 'react'
import { db, duplicarConfig } from '../lib/datos'
import { deConfig, type ProductoCompleto } from '../lib/tipos'
import { borrarFoto } from '../lib/fotos'
import { CampoTexto } from './ui'
import { Foto } from './Foto'
import { SeccionSpecs } from './SeccionSpecs'
import { SeccionMatriz } from './SeccionMatriz'
import { SeccionGaleria } from './SeccionGaleria'

/**
 * Las versiones del producto (el acolchado a cuadros y el a rayas).
 * Cuando hay una sola no se muestran solapas: el concepto no molesta hasta
 * que hace falta.
 */
export function Configuraciones({ datos }: { datos: ProductoCompleto }) {
  const { producto, configs } = datos
  const [activa, setActiva] = useState<string | null>(configs[0]?.id ?? null)

  // si borran la configuración abierta, saltar a la primera que quede
  useEffect(() => {
    if (!configs.length) { setActiva(null); return }
    if (!activa || !configs.some((c) => c.id === activa)) setActiva(configs[0].id)
  }, [configs, activa])

  const config = configs.find((c) => c.id === activa) ?? configs[0]

  const total = (cid: string) =>
    datos.variantes.filter((v) => v.config_id === cid).reduce((s, v) => s + v.cantidad, 0)

  const agregar = async () => {
    const { data } = await db.agregar('configuraciones', {
      producto_id: producto.id,
      nombre: `Versión ${configs.length + 1}`,
      orden: configs.length,
    })
    if (data) setActiva(data.id as string)
  }

  const duplicar = async () => {
    if (!config) return
    const nueva = await duplicarConfig(producto.id, {
      config,
      specs: deConfig(datos.specs, config.id),
      medidas: deConfig(datos.medidas, config.id),
      colores: deConfig(datos.colores, config.id),
      variantes: deConfig(datos.variantes, config.id),
      fotos: deConfig(datos.fotos, config.id),
    }, configs.length)
    if (nueva) setActiva(nueva)
  }

  if (!config) {
    return (
      <section className="tarjeta p-4 text-center">
        <p className="text-sm text-neutral-400 mb-3">Este producto no tiene ninguna versión.</p>
        <button onClick={agregar} className="btn btn-chico">+ Agregar una versión</button>
      </section>
    )
  }

  const varias = configs.length > 1

  return (
    <section className="tarjeta overflow-hidden">
      {/* solapas: solo cuando hay más de una versión */}
      {varias && (
        <div className="flex gap-1 px-2 pt-2 border-b border-neutral-200 overflow-x-auto">
          {configs.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiva(c.id)}
              className={`px-3 py-2 text-sm rounded-t whitespace-nowrap transition-colors
                          border-b-2 -mb-px
                          ${c.id === config.id
                            ? 'border-neutral-900 font-medium text-neutral-900'
                            : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
            >
              {c.nombre}
              {total(c.id) > 0 && (
                <span className="ml-1.5 text-xs text-neutral-400 tabular-nums">
                  {total(c.id).toLocaleString('es-AR')}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={agregar}
            className="px-3 py-2 text-sm text-neutral-400 hover:text-neutral-900 transition-colors"
            title="Agregar otra versión"
          >
            +
          </button>
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* encabezado de la versión */}
        <div className="flex flex-wrap gap-3 items-start">
          <Foto
            url={config.foto}
            tamaño="sm"
            carpeta="configs"
            etiqueta="Foto"
            onCambio={(url) => {
              if (!url && config.foto) borrarFoto(config.foto)
              db.actualizar('configuraciones', config.id, { foto: url })
            }}
          />
          <div className="flex-1 min-w-0">
            {varias ? (
              <CampoTexto
                valor={config.nombre}
                onGuardar={(v) => db.actualizar('configuraciones', config.id, { nombre: v ?? 'Sin nombre' })}
                className="text-base font-semibold -ml-2"
              />
            ) : (
              <h3 className="titulo-seccion pt-1">Medidas, colores y detalles</h3>
            )}
            <CampoTexto
              valor={config.descripcion}
              onGuardar={(v) => db.actualizar('configuraciones', config.id, { descripcion: v })}
              placeholder={varias
                ? 'Qué distingue a esta versión…'
                : 'Detalle de la versión (opcional)…'}
              className="text-sm text-neutral-600"
            />
          </div>
          <div className="flex gap-1 shrink-0 w-full sm:w-auto">
            {!varias && (
              <button onClick={agregar} className="btn btn-chico" title="Agregar otra versión del producto">
                + Otra versión
              </button>
            )}
            {varias && (
              <>
                <button onClick={duplicar} className="btn btn-chico">Duplicar</button>
                <button
                  onClick={() => {
                    if (confirm(`¿Borrar la versión "${config.nombre}" con todo su contenido?`)) {
                      db.borrar('configuraciones', config.id)
                    }
                  }}
                  className="btn btn-chico text-neutral-500 hover:text-red-600"
                >
                  Borrar
                </button>
              </>
            )}
          </div>
        </div>

        <SeccionMatriz
          producto={producto}
          configId={config.id}
          medidas={deConfig(datos.medidas, config.id)}
          colores={deConfig(datos.colores, config.id)}
          variantes={deConfig(datos.variantes, config.id)}
        />

        <SeccionSpecs
          productoId={producto.id}
          configId={config.id}
          specs={deConfig(datos.specs, config.id)}
          titulo={varias ? `Detalles de ${config.nombre}` : 'Detalles'}
          sinCaja
        />

        <SeccionGaleria
          productoId={producto.id}
          configId={config.id}
          fotos={deConfig(datos.fotos, config.id)}
        />
      </div>
    </section>
  )
}
