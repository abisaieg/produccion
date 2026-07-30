import { useEffect, useState } from 'react'
import { traerCompletos } from '../lib/datos'
import { descargar, generarExcel, imagenesQueFaltaron, nombreArchivo } from '../lib/excel'
import type { Idioma } from '../lib/traducir'
import type { ProductoCompleto } from '../lib/tipos'
import { Modal } from './ui'

const IDIOMAS: { valor: Idioma; texto: string; detalle: string }[] = [
  { valor: 'ambos', texto: 'Español + inglés', detalle: 'Cada texto con su traducción abajo' },
  { valor: 'en', texto: 'Solo inglés', detalle: 'Para mandarle directo a la fábrica' },
  { valor: 'es', texto: 'Solo español', detalle: 'Para uso interno' },
]

export function Exportar({ ids, onCerrar, onListo }: {
  ids: string[]
  onCerrar: () => void
  onListo: (mensaje: string) => void
}) {
  const [productos, setProductos] = useState<ProductoCompleto[] | null>(null)
  const [conFotos, setConFotos] = useState(true)
  const [idioma, setIdioma] = useState<Idioma>('ambos')
  const [generando, setGenerando] = useState(false)
  const [paso, setPaso] = useState('')

  useEffect(() => { traerCompletos(ids).then(setProductos) }, [ids])

  const totalFotos = productos
    ? productos.reduce(
        (s, p) =>
          s + (p.producto.foto ? 1 : 0) + p.fotos.length +
          p.specs.filter((e) => e.foto).length,
        0)
    : 0

  const totalUnidades = productos
    ? productos.reduce((s, p) => s + p.variantes.reduce((t, v) => t + v.cantidad, 0), 0)
    : 0

  async function generar() {
    if (!productos?.length) return
    setGenerando(true)
    try {
      if (idioma !== 'es') setPaso('Traduciendo al inglés…')
      else setPaso('Armando la planilla…')

      const blob = await generarExcel(productos, { conFotos, idioma })
      descargar(blob, nombreArchivo(productos))

      const faltaron = imagenesQueFaltaron().length
      onListo(faltaron
        ? `Excel descargado — ${faltaron} ${faltaron === 1 ? 'imagen no pudo incluirse' : 'imágenes no pudieron incluirse'}`
        : 'Excel descargado')
      onCerrar()
    } catch (e) {
      onListo(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    } finally {
      setGenerando(false)
      setPaso('')
    }
  }

  return (
    <Modal titulo="Descargar Excel" onCerrar={onCerrar}>
      {!productos ? (
        <p className="text-sm text-neutral-400 py-4 text-center animate-pulse">Preparando…</p>
      ) : (
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium mb-1">
              {productos.length === 1
                ? productos[0].producto.nombre
                : `${productos.length} productos`}
            </p>
            <p className="text-neutral-500 text-xs">
              {totalUnidades.toLocaleString('es-AR')} unidades · {totalFotos}{' '}
              {totalFotos === 1 ? 'foto' : 'fotos'}
            </p>
          </div>

          <div>
            <p className="titulo-seccion mb-2">Idioma</p>
            <div className="space-y-1.5">
              {IDIOMAS.map((i) => (
                <button
                  key={i.valor}
                  onClick={() => setIdioma(i.valor)}
                  className={`w-full text-left px-3 py-2 rounded border transition-colors
                              ${idioma === i.valor
                                ? 'border-neutral-900 bg-neutral-50'
                                : 'border-neutral-200 hover:border-neutral-400'}`}
                >
                  <div className="text-sm font-medium">{i.texto}</div>
                  <div className="text-xs text-neutral-500">{i.detalle}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={conFotos}
              onChange={(e) => setConFotos(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-neutral-900"
            />
            <span>
              <span className="text-sm font-medium">Incluir las fotos en el archivo</span>
              <span className="block text-xs text-neutral-500">
                {totalFotos > 0
                  ? `Embebe las ${totalFotos} fotos. El archivo pesa más y tarda unos segundos.`
                  : 'Todavía no hay fotos cargadas.'}
              </span>
            </span>
          </label>

          <div className="pt-2 flex gap-2">
            <button onClick={onCerrar} className="btn flex-1">Cancelar</button>
            <button
              onClick={generar}
              disabled={generando}
              className="btn btn-negro flex-1"
            >
              {generando ? (paso || 'Generando…') : 'Descargar'}
            </button>
          </div>

          {generando && (
            <p className="text-xs text-neutral-400 text-center">
              No cierres esta ventana.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
