import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/datos'
import {
  COLORES_SUGERIDOS, MEDIDAS_SUGERIDAS,
  type Color, type Configuracion, type Medida, type Producto, type Variante,
} from '../lib/tipos'
import { AltaRapida, BotonBorrar, CampoTexto } from './ui'
import { Foto } from './Foto'
import { borrarFoto } from '../lib/fotos'

/**
 * El reparto del contenedor: qué parte va a cada medida y, dentro de ella,
 * a cada color. Filas = medidas, columnas = colores.
 *
 * Se carga en porcentajes, que es como se arma un pedido de verdad ("45%
 * Queen, 40% Twin, 15% King"), y las unidades salen de la cuenta contra el
 * total del contenedor. También se puede cargar en unidades directas.
 */
export function SeccionMatriz({ producto, config, medidas, colores, variantes }: {
  producto: Producto
  config: Configuracion
  medidas: Medida[]
  colores: Color[]
  variantes: Variante[]
}) {
  const configId = config.id
  const total = config.total_unidades

  const [mostrarPrecios, setMostrarPrecios] = useState(
    medidas.some((m) => m.precio_unit != null),
  )
  const [alta, setAlta] = useState<'medidas' | 'colores' | null>(null)
  const [modo, setModo] = useState<'pct' | 'unidades'>(
    variantes.some((v) => v.porcentaje != null) || !variantes.some((v) => v.cantidad > 0)
      ? 'pct'
      : 'unidades',
  )

  const celda = (medidaId: string, colorId: string) =>
    variantes.find((v) => v.medida_id === medidaId && v.color_id === colorId)

  const cantidad = (mid: string, cid: string) => celda(mid, cid)?.cantidad ?? 0
  const pct = (mid: string, cid: string) => celda(mid, cid)?.porcentaje ?? null

  const pctFila = (mid: string) =>
    colores.reduce((s, c) => s + (pct(mid, c.id) ?? 0), 0)
  const pctColumna = (cid: string) =>
    medidas.reduce((s, m) => s + (pct(m.id, cid) ?? 0), 0)
  const pctTotal = medidas.reduce((s, m) => s + pctFila(m.id), 0)

  const totalFila = (mid: string) => colores.reduce((s, c) => s + cantidad(mid, c.id), 0)
  const totalColumna = (cid: string) => medidas.reduce((s, m) => s + cantidad(m.id, cid), 0)
  const totalGeneral = medidas.reduce((s, m) => s + totalFila(m.id), 0)

  const montoTotal = medidas.reduce((s, m) => {
    if (m.precio_unit == null) return s
    return s + Number(m.precio_unit) * totalFila(m.id)
  }, 0)

  const agregarMedidas = (nombres: string[]) =>
    db.agregarVarias('medidas', nombres.map((nombre, i) => ({
      producto_id: producto.id, config_id: configId, nombre,
      orden: medidas.length + i,
    })))
  const agregarColores = (nombres: string[]) =>
    db.agregarVarias('colores', nombres.map((nombre, i) => ({
      producto_id: producto.id, config_id: configId,
      nombre, orden: colores.length + i,
    })))

  /**
   * Toma el porcentaje de cada medida y lo divide en partes iguales entre
   * los colores. Es el paso que evita cargar celda por celda.
   */
  const repartir = async () => {
    if (!colores.length) return
    const filas = medidas.flatMap((m) => {
      const pm = m.porcentaje
      if (pm == null) return []
      const porColor = Number((pm / colores.length).toFixed(3))
      return colores.map((c) => ({
        producto_id: producto.id,
        config_id: configId,
        medida_id: m.id,
        color_id: c.id,
        porcentaje: porColor,
        cantidad: total ? Math.round(total * porColor / 100) : 0,
      }))
    })
    if (filas.length) await db.setVariasCeldas(filas)
  }

  const hayPctMedida = medidas.some((m) => m.porcentaje != null)
  const sumaPctMedidas = medidas.reduce((s, m) => s + (m.porcentaje ?? 0), 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="titulo-seccion">Reparto del contenedor</h3>
        <div className="flex gap-1.5 flex-wrap">
          {medidas.length > 0 && (
            <div className="flex rounded border border-neutral-300 overflow-hidden">
              <button
                onClick={() => setModo('pct')}
                className={`px-2.5 py-1 text-xs ${modo === 'pct'
                  ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-100'}`}
              >
                %
              </button>
              <button
                onClick={() => setModo('unidades')}
                className={`px-2.5 py-1 text-xs border-l border-neutral-300 ${modo === 'unidades'
                  ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-100'}`}
              >
                Unidades
              </button>
            </div>
          )}
          {medidas.length > 0 && (
            <button
              onClick={() => setMostrarPrecios(!mostrarPrecios)}
              className={`btn btn-chico ${mostrarPrecios ? 'btn-negro' : ''}`}
            >
              Precios
            </button>
          )}
          <button onClick={() => setAlta('medidas')} className="btn btn-chico">+ Medidas</button>
          <button
            onClick={() => setAlta('colores')}
            className="btn btn-chico"
            disabled={!medidas.length}
          >
            + Colores
          </button>
        </div>
      </div>

      {/* el contenedor de este diseño */}
      {medidas.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="text-xs text-neutral-500">Contenedor</label>
          <div className="w-28">
            <CampoTexto
              tipo="number"
              valor={total != null ? String(total) : null}
              onGuardar={(v) => db.actualizar('configuraciones', configId, {
                total_unidades: v ? Math.round(Number(v)) : null,
              })}
              placeholder="unidades"
              className="campo-caja text-sm text-right tabular-nums py-1"
            />
          </div>
          <span className="text-xs text-neutral-500">unidades</span>

          {hayPctMedida && (
            <button onClick={repartir} className="btn btn-chico ml-auto">
              Repartir entre colores
            </button>
          )}
        </div>
      )}

      {alta === 'medidas' && (
        <AltaRapida
          etiqueta="Medidas"
          ejemplo="o escribí otras, separadas por coma"
          sugerencias={MEDIDAS_SUGERIDAS.filter(
            (m) => !medidas.some((x) => x.nombre.toLowerCase() === m.nombre.toLowerCase()))}
          onCrear={agregarMedidas}
          onCerrar={() => setAlta(null)}
        />
      )}
      {alta === 'colores' && (
        <AltaRapida
          etiqueta="Colores"
          ejemplo="o escribí otros, separados por coma"
          sugerencias={COLORES_SUGERIDOS
            .filter((c) => !colores.some((x) => x.nombre.toLowerCase() === c.toLowerCase()))
            .map((nombre) => ({ nombre }))}
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
                <th className="text-center font-medium text-neutral-500 text-xs pb-2 px-1 w-20">
                  % del cont.
                </th>
                {mostrarPrecios && (
                  <th className="text-right font-medium text-neutral-500 text-xs pb-2 px-2 w-24">
                    Precio U.
                  </th>
                )}
                {colores.map((c) => (
                  <th key={c.id} className="pb-2 px-1 min-w-[92px] align-bottom">
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
                        className="text-xs text-neutral-500 w-24 shrink-0"
                      />
                      <BotonBorrar
                        titulo="Borrar medida"
                        onBorrar={() => db.borrar('medidas', m.id)}
                      />
                    </div>
                  </td>

                  {/* qué parte del contenedor va a esta medida */}
                  <td className="px-1">
                    <PctMedida
                      medida={m}
                      total={total}
                      cargado={pctFila(m.id)}
                    />
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
                        cantidad={cantidad(m.id, c.id)}
                        porcentaje={pct(m.id, c.id)}
                        modo={modo}
                        total={total}
                      />
                    </td>
                  ))}

                  <td className="px-2 text-center bg-neutral-50">
                    <div className="font-semibold tabular-nums">
                      {modo === 'pct'
                        ? `${redondear(pctFila(m.id))}%`
                        : totalFila(m.id).toLocaleString('es-AR')}
                    </div>
                    {modo === 'pct' && total != null && (
                      <div className="text-[10px] text-neutral-400 tabular-nums">
                        {totalFila(m.id).toLocaleString('es-AR')}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              <tr className="border-t-2 border-neutral-900 bg-neutral-50">
                <td className="py-2 pr-3 font-semibold text-sm sticky left-0 bg-neutral-50 z-10">
                  Total
                </td>
                <td className="px-1 text-center">
                  <span className={`text-xs font-semibold tabular-nums
                    ${hayPctMedida && Math.abs(sumaPctMedidas - 100) > 0.5 ? 'text-amber-600' : ''}`}>
                    {hayPctMedida ? `${redondear(sumaPctMedidas)}%` : ''}
                  </span>
                </td>
                {mostrarPrecios && <td />}
                {colores.map((c) => (
                  <td key={c.id} className="px-2 text-center">
                    <div className="font-semibold tabular-nums text-sm">
                      {modo === 'pct'
                        ? `${redondear(pctColumna(c.id))}%`
                        : totalColumna(c.id).toLocaleString('es-AR')}
                    </div>
                    {modo === 'pct' && total != null && (
                      <div className="text-[10px] text-neutral-400 tabular-nums">
                        {totalColumna(c.id).toLocaleString('es-AR')}
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-2 text-center">
                  <div className={`font-bold tabular-nums
                    ${modo === 'pct' && pctTotal > 0 && Math.abs(pctTotal - 100) > 0.5
                      ? 'text-amber-600' : ''}`}>
                    {modo === 'pct'
                      ? `${redondear(pctTotal)}%`
                      : totalGeneral.toLocaleString('es-AR')}
                  </div>
                  {modo === 'pct' && total != null && (
                    <div className="text-[10px] text-neutral-400 tabular-nums">
                      {totalGeneral.toLocaleString('es-AR')}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {colores.length === 0 && (
            <p className="text-xs text-neutral-400 mt-3">
              Agregá los colores para repartir las cantidades.
            </p>
          )}

          {modo === 'pct' && pctTotal > 0 && Math.abs(pctTotal - 100) > 0.5 && (
            <p className="text-xs text-amber-600 mt-2">
              Los porcentajes suman {redondear(pctTotal)}%, no 100%.
            </p>
          )}
          {modo === 'pct' && total == null && pctTotal > 0 && (
            <p className="text-xs text-neutral-500 mt-2">
              Cargá las unidades del contenedor para ver a cuántas equivale cada porcentaje.
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

/** Muestra los porcentajes sin decimales de más. */
function redondear(n: number) {
  return Number(n.toFixed(2)).toLocaleString('es-AR')
}

// ------------------------------------------------------- % de cada medida

function PctMedida({ medida, total, cargado }: {
  medida: Medida
  total: number | null
  /** lo que suman las celdas de esa fila, para avisar si no coincide */
  cargado: number
}) {
  const p = medida.porcentaje
  const difiere = p != null && cargado > 0 && Math.abs(cargado - p) > 0.5

  return (
    <div className="text-center">
      <CampoTexto
        tipo="number"
        valor={p != null ? String(p) : null}
        onGuardar={(v) => db.actualizar('medidas', medida.id, {
          porcentaje: v != null && v !== '' ? Number(v) : null,
        })}
        placeholder="—"
        className={`text-sm text-center tabular-nums ${difiere ? 'text-amber-600' : ''}`}
      />
      {p != null && total != null && (
        <div className="text-[10px] text-neutral-400 tabular-nums -mt-0.5">
          {Math.round(total * p / 100).toLocaleString('es-AR')}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------- encabezado

/**
 * Encabezado de la columna: foto de la tela o estampa, muestra de color,
 * nombre y cruz para quitarlo. La foto es lo que mejor entiende la fábrica.
 */
function EncabezadoColor({ color }: { color: Color }) {
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <Foto
        url={color.foto}
        tamaño="sm"
        carpeta="colores"
        etiqueta="Foto"
        onCambio={(url) => {
          if (!url && color.foto) borrarFoto(color.foto)
          db.actualizar('colores', color.id, { foto: url })
        }}
      />
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
          onClick={() => {
            if (color.foto) borrarFoto(color.foto)
            db.borrar('colores', color.id)
          }}
          title="Quitar color"
          className="text-neutral-300 hover:text-red-600 transition-colors shrink-0
                     text-sm leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ celda

/** Celda de la matriz: se carga en porcentaje o en unidades, según el modo. */
function Celda({ productoId, configId, medidaId, colorId, cantidad, porcentaje, modo, total }: {
  productoId: string
  configId: string
  medidaId: string
  colorId: string
  cantidad: number
  porcentaje: number | null
  modo: 'pct' | 'unidades'
  total: number | null
}) {
  const valorExterno = modo === 'pct'
    ? (porcentaje != null ? String(porcentaje) : '')
    : (cantidad ? String(cantidad) : '')

  const [local, setLocal] = useState(valorExterno)
  const enfocado = useRef(false)
  const ultimoExterno = useRef(valorExterno)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // solo sincronizamos ante un cambio real de la base, nunca al perder el
  // foco: pisaría lo recién tipeado
  useEffect(() => {
    if (valorExterno === ultimoExterno.current) return
    ultimoExterno.current = valorExterno
    if (enfocado.current) return
    setLocal(valorExterno)
  }, [valorExterno])

  useEffect(() => () => clearTimeout(timer.current), [])

  const guardar = (v: string) => {
    clearTimeout(timer.current)
    if (modo === 'pct') {
      const n = v === '' ? null : Math.max(0, Number(v))
      if (n != null && Number.isNaN(n)) return
      if (n === porcentaje) return
      db.setPorcentaje(productoId, configId, medidaId, colorId, n, total)
    } else {
      const n = v === '' ? 0 : Math.max(0, Math.round(Number(v)))
      if (Number.isNaN(n) || n === cantidad) return
      db.setCantidad(productoId, configId, medidaId, colorId, n)
    }
  }

  const unidades = modo === 'pct' && total != null && porcentaje != null
    ? Math.round(total * porcentaje / 100)
    : null

  return (
    <div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={local}
          placeholder={modo === 'pct' ? '—' : '0'}
          onChange={(e) => {
            setLocal(e.target.value)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => guardar(e.target.value), 600)
          }}
          onFocus={(e) => { enfocado.current = true; e.target.select() }}
          onBlur={() => { enfocado.current = false; guardar(local) }}
          className={`w-full text-center py-1.5 rounded border tabular-nums text-sm
                      focus:outline-none focus:border-neutral-900 transition-colors
                      ${local && local !== '0'
                        ? 'border-neutral-200 bg-white font-medium'
                        : 'border-transparent bg-neutral-50 text-neutral-300'}
                      ${modo === 'pct' ? 'pr-4' : ''}`}
        />
        {modo === 'pct' && local && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]
                           text-neutral-400 pointer-events-none">
            %
          </span>
        )}
      </div>
      {unidades != null && (
        <div className="text-[10px] text-neutral-400 text-center tabular-nums">
          {unidades.toLocaleString('es-AR')}
        </div>
      )}
    </div>
  )
}
