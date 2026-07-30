import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/datos'
import type { Color, Medida, Producto, Variante } from '../lib/tipos'
import { AltaRapida, BotonBorrar, CampoTexto } from './ui'

/**
 * El corazón del pedido: cuántas unidades de cada color en cada medida.
 * Filas = medidas, columnas = colores, celdas = cantidad.
 */
export function SeccionMatriz({ producto, configId, medidas, colores, variantes }: {
  producto: Producto
  configId: string
  medidas: Medida[]
  colores: Color[]
  variantes: Variante[]
}) {
  const [mostrarPrecios, setMostrarPrecios] = useState(
    medidas.some((m) => m.precio_unit != null),
  )
  const [alta, setAlta] = useState<'medidas' | 'colores' | null>(null)

  const cantidad = (medidaId: string, colorId: string) =>
    variantes.find((v) => v.medida_id === medidaId && v.color_id === colorId)?.cantidad ?? 0

  const totalFila = (medidaId: string) =>
    colores.reduce((s, c) => s + cantidad(medidaId, c.id), 0)
  const totalColumna = (colorId: string) =>
    medidas.reduce((s, m) => s + cantidad(m.id, colorId), 0)
  const totalGeneral = medidas.reduce((s, m) => s + totalFila(m.id), 0)

  const montoTotal = medidas.reduce((s, m) => {
    if (m.precio_unit == null) return s
    return s + Number(m.precio_unit) * totalFila(m.id)
  }, 0)

  const agregarMedidas = (nombres: string[]) =>
    db.agregarVarias('medidas', nombres.map((nombre, i) => ({
      producto_id: producto.id, config_id: configId,
      nombre, orden: medidas.length + i,
    })))
  const agregarColores = (nombres: string[]) =>
    db.agregarVarias('colores', nombres.map((nombre, i) => ({
      producto_id: producto.id, config_id: configId,
      nombre, orden: colores.length + i,
    })))

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="titulo-seccion">Medidas y colores</h3>
        <div className="flex gap-1.5">
          {medidas.length > 0 && (
            <button
              onClick={() => setMostrarPrecios(!mostrarPrecios)}
              className={`btn btn-chico ${mostrarPrecios ? 'btn-negro' : ''}`}
            >
              Precios
            </button>
          )}
          <button onClick={() => { setAlta('medidas'); }} className="btn btn-chico">+ Medidas</button>
          <button
            onClick={() => setAlta('colores')}
            className="btn btn-chico"
            disabled={!medidas.length}
          >
            + Colores
          </button>
        </div>
      </div>

      {alta === 'medidas' && (
        <AltaRapida
          etiqueta="Medidas"
          ejemplo="1 plaza, 2 plazas, King"
          onCrear={agregarMedidas}
          onCerrar={() => setAlta(null)}
        />
      )}
      {alta === 'colores' && (
        <AltaRapida
          etiqueta="Colores"
          ejemplo="Beige, Azul, Gris, Verde"
          onCrear={agregarColores}
          onCerrar={() => setAlta(null)}
        />
      )}

      {medidas.length === 0 ? (
        alta ? null : (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-400 mb-3">
              Cargá las medidas y después los colores.
            </p>
            <button onClick={() => setAlta('medidas')} className="btn btn-chico">
              + Cargar las medidas
            </button>
          </div>
        )
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-neutral-500 text-xs pb-2 pr-3
                               sticky left-0 bg-white z-10 min-w-[150px] sm:min-w-[190px]">
                  Medida
                </th>
                {mostrarPrecios && (
                  <th className="text-right font-medium text-neutral-500 text-xs pb-2 px-2 w-24">
                    Precio U.
                  </th>
                )}
                {colores.map((c) => (
                  <th key={c.id} className="pb-2 px-1 min-w-[84px]">
                    <EncabezadoColor color={c} />
                  </th>
                ))}
                <th className="text-center font-medium text-neutral-500 text-xs pb-2 px-2 w-20">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {medidas.map((m) => (
                <tr key={m.id} className="group border-t border-neutral-100">
                  {/* el tacho va acá y no al final: en el celular, al final
                      de la tabla quedaría fuera de la pantalla */}
                  {/* nombre, medida y tacho en una sola línea */}
                  <td className="py-1 pr-3 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-1">
                      <CampoTexto
                        valor={m.nombre}
                        onGuardar={(v) => db.actualizar('medidas', m.id, { nombre: v ?? 'Sin nombre' })}
                        className="text-sm font-medium flex-1 min-w-0"
                      />
                      <CampoTexto
                        valor={m.detalle}
                        onGuardar={(v) => db.actualizar('medidas', m.id, { detalle: v })}
                        placeholder="240 x 260"
                        className="text-xs text-neutral-500 w-24 shrink-0"
                      />
                      <BotonBorrar
                        titulo="Borrar medida"
                        onBorrar={() => db.borrar('medidas', m.id)}
                      />
                    </div>
                  </td>

                  {mostrarPrecios && (
                    <td className="px-1">
                      <CampoTexto
                        tipo="number"
                        valor={m.precio_unit != null ? String(m.precio_unit) : null}
                        onGuardar={(v) =>
                          db.actualizar('medidas', m.id, {
                            precio_unit: v != null && v !== '' ? Number(v) : null,
                          })}
                        placeholder="—"
                        className="text-sm text-right tabular-nums"
                      />
                    </td>
                  )}

                  {colores.map((c) => (
                    <td key={c.id} className="px-0.5">
                      <Celda
                        productoId={producto.id}
                        configId={configId}
                        medidaId={m.id}
                        colorId={c.id}
                        valor={cantidad(m.id, c.id)}
                      />
                    </td>
                  ))}

                  <td className="px-2 text-center font-semibold tabular-nums bg-neutral-50">
                    {totalFila(m.id).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}

              <tr className="border-t-2 border-neutral-900 bg-neutral-50">
                <td className="py-2 pr-3 font-semibold text-sm sticky left-0 bg-neutral-50 z-10">
                  Total
                </td>
                {mostrarPrecios && <td />}
                {colores.map((c) => (
                  <td key={c.id} className="px-2 text-center font-semibold tabular-nums text-sm">
                    {totalColumna(c.id).toLocaleString('es-AR')}
                  </td>
                ))}
                <td className="px-2 text-center font-bold tabular-nums">
                  {totalGeneral.toLocaleString('es-AR')}
                </td>
              </tr>
            </tbody>
          </table>

          {colores.length === 0 && (
            <p className="text-xs text-neutral-400 mt-3">
              Agregá los colores para cargar las cantidades de cada uno.
            </p>
          )}
        </div>
      )}

      {mostrarPrecios && montoTotal > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between items-baseline">
          <span className="text-sm text-neutral-500">
            Total del pedido ({totalGeneral.toLocaleString('es-AR')} u.)
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {producto.moneda} {montoTotal.toLocaleString('es-AR', {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------- encabezado

/** Muestra de color, nombre y cruz para quitarlo, todo en una línea. */
function EncabezadoColor({ color }: { color: Color }) {
  return (
    <div className="flex items-center gap-0.5 w-full">
      <input
        type="color"
        value={color.hex ?? '#cccccc'}
        onChange={(e) => db.actualizar('colores', color.id, { hex: e.target.value })}
        className="w-4 h-4 shrink-0 rounded-full border border-neutral-300 cursor-pointer
                   appearance-none p-0 overflow-hidden"
        style={{ backgroundColor: color.hex ?? '#cccccc' }}
        title="Color de referencia"
      />
      <CampoTexto
        valor={color.nombre}
        onGuardar={(v) => db.actualizar('colores', color.id, { nombre: v ?? 'Sin nombre' })}
        className="text-xs font-medium px-1 flex-1 min-w-0"
      />
      <button
        onClick={() => db.borrar('colores', color.id)}
        title="Quitar color"
        className="text-neutral-300 hover:text-red-600 transition-colors shrink-0
                   text-sm leading-none px-1"
      >
        ×
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ celda

/** Input de cantidad: guarda al salir o al frenar de tipear. */
function Celda({ productoId, configId, medidaId, colorId, valor }: {
  productoId: string
  configId: string
  medidaId: string
  colorId: string
  valor: number
}) {
  const [local, setLocal] = useState(valor ? String(valor) : '')
  const enfocado = useRef(false)
  const ultimoExterno = useRef(valor)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // igual que en CampoTexto: solo sincronizamos ante un cambio real de la
  // base, nunca al perder el foco (pisaría lo recién tipeado)
  useEffect(() => {
    if (valor === ultimoExterno.current) return
    ultimoExterno.current = valor
    if (enfocado.current) return
    setLocal(valor ? String(valor) : '')
  }, [valor])

  useEffect(() => () => clearTimeout(timer.current), [])

  const guardar = (v: string) => {
    clearTimeout(timer.current)
    const n = v === '' ? 0 : Math.max(0, Math.round(Number(v)))
    if (Number.isNaN(n) || n === valor) return
    db.setCantidad(productoId, configId, medidaId, colorId, n)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={local}
      placeholder="0"
      onChange={(e) => {
        setLocal(e.target.value)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => guardar(e.target.value), 600)
      }}
      onFocus={(e) => { enfocado.current = true; e.target.select() }}
      onBlur={() => {
        enfocado.current = false
        guardar(local)
      }}
      className={`w-full text-center py-1.5 rounded border tabular-nums text-sm
                  focus:outline-none focus:border-neutral-900 transition-colors
                  ${local && local !== '0'
                    ? 'border-neutral-200 bg-white font-medium'
                    : 'border-transparent bg-neutral-50 text-neutral-300'}`}
    />
  )
}
