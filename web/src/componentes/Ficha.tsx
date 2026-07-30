import { db, duplicarProducto, useProducto } from '../lib/datos'
import { ESTADOS, estadoInfo } from '../lib/tipos'
import { borrarFoto } from '../lib/fotos'
import { CampoTexto, Cargando } from './ui'
import { Foto } from './Foto'
import { SeccionSpecs } from './SeccionSpecs'
import { SeccionNotas } from './SeccionNotas'
import { Configuraciones } from './Configuraciones'

export function Ficha({ id, onVolver, onExportar, onDuplicado, onAviso }: {
  id: string
  onVolver: () => void
  onExportar: (ids: string[]) => void
  onDuplicado: (nuevoId: string) => void
  onAviso: (mensaje: string) => void
}) {
  const { datos, cargando, falla, recargar } = useProducto(id)

  if (cargando) return <Cargando />

  // no se pudieron traer los datos: el producto sigue estando, así que
  // nunca decimos que se borró
  if (falla) {
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-700 mb-1">No se pudieron cargar los datos.</p>
        <p className="text-sm text-neutral-500 mb-4">
          Puede ser la conexión o que haya caducado el acceso. Tu producto está a salvo.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => recargar()} className="btn btn-negro">Reintentar</button>
          <button onClick={onVolver} className="btn">Volver</button>
        </div>
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-500 mb-4">Este producto ya no existe.</p>
        <button onClick={onVolver} className="btn">Volver</button>
      </div>
    )
  }

  const { producto: p, specs, notas } = datos
  const specsGenerales = specs.filter((s) => !s.config_id)
  const idsGenerales = new Set(specsGenerales.map((s) => s.id))
  const fotosGenerales = datos.fotos.filter((x) => x.spec_id && idsGenerales.has(x.spec_id))
  const set = (cambios: Record<string, unknown>) => db.actualizarProducto(p.id, cambios)

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* barra superior */}
      <div className="sticky top-0 z-20 bg-neutral-50/95 backdrop-blur border-b border-neutral-200
                      px-4 py-2.5 flex items-center gap-2">
        <button onClick={onVolver} className="btn btn-chico">← Productos</button>
        <div className="flex-1" />
        <button
          onClick={async () => {
            const nuevo = await duplicarProducto(p.id)
            if (nuevo) onDuplicado(nuevo)
          }}
          className="btn btn-chico"
        >
          Duplicar
        </button>
        <button onClick={() => onExportar([p.id])} className="btn btn-chico btn-negro">
          <span className="hidden sm:inline">Descargar&nbsp;</span>Excel
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* encabezado */}
        <section className="tarjeta p-4">
          <div className="flex gap-4">
            <Foto
              url={p.foto}
              tamaño="md"
              carpeta="principal"
              etiqueta="Muestra"
              onCambio={(url) => {
                if (!url && p.foto) borrarFoto(p.foto)
                set({ foto: url })
              }}
            />

            <div className="flex-1 min-w-0">
              <CampoTexto
                valor={p.nombre}
                onGuardar={(v) => set({ nombre: v ?? 'Sin nombre' })}
                className="text-xl font-semibold -ml-2"
              />

              <div className="flex flex-wrap gap-1.5 mt-2">
                {ESTADOS.map((e) => (
                  <button
                    key={e.valor}
                    onClick={() => set({ estado: e.valor })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all
                                ${p.estado === e.valor
                                  ? e.clase
                                  : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-400'}`}
                  >
                    {e.texto}
                  </button>
                ))}
              </div>

              <div className="hidden sm:grid grid-cols-4 gap-x-3 gap-y-1 mt-3">
                <Dato etiqueta="Código">
                  <CampoTexto valor={p.codigo} onGuardar={(v) => set({ codigo: v })}
                              placeholder="—" className="text-sm" />
                </Dato>
                <Dato etiqueta="Proveedor">
                  <CampoTexto valor={p.proveedor} onGuardar={(v) => set({ proveedor: v })}
                              placeholder="—" className="text-sm" />
                </Dato>
                <Dato etiqueta="Categoría">
                  <CampoTexto valor={p.categoria} onGuardar={(v) => set({ categoria: v })}
                              placeholder="—" className="text-sm" />
                </Dato>
                <Dato etiqueta="Moneda">
                  <select
                    value={p.moneda}
                    onChange={(e) => set({ moneda: e.target.value })}
                    className="campo text-sm cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                    <option value="ARS">ARS</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Dato>
              </div>
            </div>
          </div>

          {/* en el celular estos campos van abajo, a dos columnas */}
          <div className="grid sm:hidden grid-cols-2 gap-x-3 gap-y-1 mt-3">
            <Dato etiqueta="Código">
              <CampoTexto valor={p.codigo} onGuardar={(v) => set({ codigo: v })}
                          placeholder="—" className="text-sm" />
            </Dato>
            <Dato etiqueta="Proveedor">
              <CampoTexto valor={p.proveedor} onGuardar={(v) => set({ proveedor: v })}
                          placeholder="—" className="text-sm" />
            </Dato>
            <Dato etiqueta="Categoría">
              <CampoTexto valor={p.categoria} onGuardar={(v) => set({ categoria: v })}
                          placeholder="—" className="text-sm" />
            </Dato>
            <Dato etiqueta="Moneda">
              <select
                value={p.moneda}
                onChange={(e) => set({ moneda: e.target.value })}
                className="campo text-sm cursor-pointer"
              >
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="ARS">ARS</option>
                <option value="EUR">EUR</option>
              </select>
            </Dato>
          </div>

          <div className="mt-3">
            <CampoTexto
              valor={p.descripcion}
              onGuardar={(v) => set({ descripcion: v })}
              placeholder="Descripción general del producto…"
              className="text-sm"
              multilinea
              filas={2}
            />
          </div>
        </section>

        {/* pendiente: lo que te permite retomar donde dejaste */}
        <section className="tarjeta p-4 border-amber-300 bg-amber-50/60">
          <h3 className="titulo-seccion text-amber-800 mb-1.5">Qué falta / dónde quedé</h3>
          <CampoTexto
            valor={p.pendiente}
            onGuardar={(v) => set({ pendiente: v })}
            placeholder="Ej: falta confirmar el gramaje y que manden foto del packaging"
            className="text-sm"
            multilinea
            filas={2}
          />
        </section>

        <Configuraciones datos={datos} onAviso={onAviso} />

        <SeccionSpecs
          productoId={p.id}
          specs={specsGenerales}
          fotos={fotosGenerales}
          titulo="Detalles iguales en todos los estilos"
          onAviso={onAviso}
        />

        <SeccionNotas productoId={p.id} notas={notas} />

        {/* pie */}
        <div className="flex items-center justify-between pt-2 pb-6 text-xs text-neutral-400">
          <span>
            Estado: {estadoInfo(p.estado).texto} · Última edición{' '}
            {new Date(p.updated_at).toLocaleString('es-AR', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => set({ archivado: !p.archivado })}
              className="hover:text-neutral-900 transition-colors"
            >
              {p.archivado ? 'Desarchivar' : 'Archivar'}
            </button>
            <button
              onClick={() => {
                if (confirm(`¿Borrar "${p.nombre}" y todo su contenido? No se puede deshacer.`)) {
                  db.borrarProducto(p.id)
                  onVolver()
                }
              }}
              className="hover:text-red-600 transition-colors"
            >
              Borrar producto
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">{etiqueta}</span>
      {children}
    </div>
  )
}
