import { useState } from 'react'
import { db, duplicarConfig } from '../lib/datos'
import {
  COLORES_INICIALES, deConfig, galeriaDe, SPECS_INICIALES,
  type Configuracion, type ProductoCompleto,
} from '../lib/tipos'
import { AltaRapida, CampoTexto } from './ui'
import { Imagenes } from './Imagenes'
import { SeccionSpecs } from './SeccionSpecs'
import { SeccionMatriz } from './SeccionMatriz'

/**
 * Los estilos del producto: el mismo acolchado a cuadros, a rayas, liso.
 *
 * Van como tarjetas apiladas y no como solapas: con solapas se veían de a
 * uno y no quedaba claro que el producto podía tener varios, así que los
 * estilos terminaban cargándose como si fueran detalles.
 */
export function Configuraciones({ datos, onAviso }: {
  datos: ProductoCompleto
  onAviso: (mensaje: string) => void
}) {
  const { producto, configs } = datos
  const [agregando, setAgregando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(configs[0]?.id ?? null)

  // las medidas del primer estilo se repiten en los nuevos
  const medidasBase = configs.length
    ? deConfig(datos.medidas, configs[0].id)
    : []

  const agregarVarios = async (nombres: string[]) => {
    const { data } = await db.agregarVarias('configuraciones', nombres.map((nombre, i) => ({
      producto_id: producto.id, nombre, orden: configs.length + i,
    })))
    const creados = (data ?? []) as { id: string }[]
    if (!creados.length) return

    // cada estilo nace con sus detalles básicos y sus colores para renombrar
    await Promise.all([
      db.agregarVarias('especificaciones', creados.flatMap((c) =>
        SPECS_INICIALES.map((nombre, i) => ({
          producto_id: producto.id, config_id: c.id, nombre, orden: i,
        })))),
      db.agregarVarias('colores', creados.flatMap((c) =>
        COLORES_INICIALES.map((nombre, i) => ({
          producto_id: producto.id, config_id: c.id, nombre, orden: i,
        })))),
      // y con las mismas medidas del primer estilo, que suelen repetirse
      medidasBase.length
        ? db.agregarVarias('medidas', creados.flatMap((c) =>
            medidasBase.map((m, i) => ({
              producto_id: producto.id, config_id: c.id,
              nombre: m.nombre, detalle: m.detalle, orden: i,
            }))))
        : Promise.resolve(),
    ])

    setAbierto(creados[0].id)
  }

  const panelAlta = (
    <AltaRapida
      etiqueta="Estilos"
      ejemplo="Diseño 1, Diseño 2, Diseño 3, Diseño 4"
      onCrear={agregarVarios}
      onCerrar={() => setAgregando(false)}
    />
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="titulo-seccion">
          Estilos del producto
          {configs.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {configs.length}
            </span>
          )}
        </h3>
        <button onClick={() => setAgregando(!agregando)} className="btn btn-chico shrink-0">
          {agregando ? 'Listo' : '+ Estilos'}
        </button>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Cada estilo lleva su propio packaging, sus medidas, sus colores y sus cantidades.
      </p>

      {agregando && panelAlta}

      {configs.length === 0 ? (
        agregando ? null : (
          <div className="tarjeta p-6 text-center">
            <p className="text-sm text-neutral-400 mb-3">
              Este producto todavía no tiene estilos.
            </p>
            <button onClick={() => setAgregando(true)} className="btn btn-negro">
              + Agregar estilos
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {configs.map((c, i) => (
            <TarjetaEstilo
              key={c.id}
              datos={datos}
              config={c}
              numero={i + 1}
              abierto={abierto === c.id}
              onAbrir={() => setAbierto(abierto === c.id ? null : c.id)}
              onDuplicado={setAbierto}
              onAviso={onAviso}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function TarjetaEstilo({ datos, config, numero, abierto, onAbrir, onDuplicado, onAviso }: {
  datos: ProductoCompleto
  config: Configuracion
  numero: number
  abierto: boolean
  onAbrir: () => void
  onDuplicado: (id: string) => void
  onAviso: (mensaje: string) => void
}) {
  const { producto, configs } = datos
  const medidas = deConfig(datos.medidas, config.id)
  const colores = deConfig(datos.colores, config.id)
  const variantes = deConfig(datos.variantes, config.id)
  const specs = deConfig(datos.specs, config.id)
  const fotosGaleria = galeriaDe(datos.fotos, config.id)
  const fotosDetalles = datos.fotos.filter((f) => f.config_id === config.id && f.spec_id)

  const portada = config.foto ?? fotosGaleria[0]?.url ?? null

  const unidades = variantes.reduce((s, v) => s + v.cantidad, 0)
  const definidos = specs.filter((s) => s.definido).length

  const duplicar = async () => {
    const nuevo = await duplicarConfig(producto.id, {
      config, specs, medidas, colores, variantes,
      fotos: [...fotosGaleria, ...fotosDetalles],
    }, configs.length)
    if (nuevo) onDuplicado(nuevo)
  }

  return (
    <div className={`tarjeta overflow-hidden transition-colors ${abierto ? 'border-neutral-900' : ''}`}>
      {/* cabecera siempre visible: se toca para abrir y cerrar */}
      <button
        onClick={onAbrir}
        className="flex items-center gap-3 w-full text-left p-3"
      >
        {portada ? (
          <img src={portada} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-neutral-100" />
        ) : (
          <div className="w-12 h-12 rounded bg-neutral-100 shrink-0 flex items-center
                          justify-center text-neutral-400 text-sm font-medium">
            {numero}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{config.nombre}</div>
          <div className="text-xs text-neutral-500 truncate">
            {[
              specs.length ? `${definidos}/${specs.length} detalles` : 'sin detalles',
              fotosGaleria.length ? `${fotosGaleria.length} fotos` : null,
              medidas.length ? `${medidas.length} medidas` : null,
              colores.length ? `${colores.length} colores` : null,
              unidades ? `${unidades.toLocaleString('es-AR')} u.` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-neutral-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-6 border-t border-neutral-100 pt-4">
          {/* nombre y texto general del estilo */}
          <div>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <CampoTexto
                  valor={config.nombre}
                  onGuardar={(v) => db.actualizar('configuraciones', config.id, { nombre: v ?? 'Sin nombre' })}
                  className="text-base font-semibold -ml-2"
                />
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={duplicar} className="btn btn-chico">Duplicar</button>
                <button
                  onClick={() => {
                    if (confirm(`¿Borrar el estilo "${config.nombre}" con todo su contenido?`)) {
                      db.borrar('configuraciones', config.id)
                    }
                  }}
                  className="btn btn-chico text-neutral-500 hover:text-red-600"
                >
                  Borrar
                </button>
              </div>
            </div>
            <CampoTexto
              valor={config.descripcion}
              onGuardar={(v) => db.actualizar('configuraciones', config.id, { descripcion: v })}
              placeholder="Texto general del diseño: qué lo distingue…"
              className="text-sm text-neutral-600"
              multilinea
              filas={2}
            />
          </div>

          {/* fotos del diseño: todas las que quieras, cada una con su texto */}
          <div>
            <h4 className="titulo-seccion mb-2">Fotos del diseño</h4>
            <Imagenes
              productoId={producto.id}
              configId={config.id}
              fotos={fotosGaleria}
              etiquetaVacio="Foto"
            />
          </div>

          <SeccionSpecs
            productoId={producto.id}
            configId={config.id}
            specs={specs}
            fotos={fotosDetalles}
            titulo={`Packaging y detalles de ${config.nombre}`}
            sinCaja
            onAviso={onAviso}
          />

          <SeccionMatriz
            producto={producto}
            config={config}
            medidas={medidas}
            colores={colores}
            variantes={variantes}
          />
        </div>
      )}
    </div>
  )
}
