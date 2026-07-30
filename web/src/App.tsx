import { useEffect, useState } from 'react'
import { haySesion } from './lib/auth'
import { Pin } from './componentes/Pin'
import { Lista } from './componentes/Lista'
import { Ficha } from './componentes/Ficha'
import { Exportar } from './componentes/Exportar'
import { Aviso, Cargando } from './componentes/ui'

export default function App() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [exportando, setExportando] = useState<string[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => { haySesion().then(setAutenticado) }, [])

  // el producto abierto vive en el hash, así el botón "atrás" del celular funciona
  useEffect(() => {
    const leer = () => setAbierto(location.hash.slice(1) || null)
    leer()
    addEventListener('hashchange', leer)
    return () => removeEventListener('hashchange', leer)
  }, [])

  const abrir = (id: string) => { location.hash = id }
  const volver = () => {
    if (location.hash) history.back()
    else setAbierto(null)
  }

  if (autenticado === null) return <Cargando texto="" />
  if (!autenticado) return <Pin onEntrar={() => setAutenticado(true)} />

  return (
    <>
      {abierto ? (
        <Ficha
          key={abierto}
          id={abierto}
          onVolver={volver}
          onExportar={setExportando}
          onDuplicado={abrir}
          onAviso={setAviso}
        />
      ) : (
        <Lista onAbrir={abrir} onExportar={setExportando} />
      )}

      {exportando && (
        <Exportar
          ids={exportando}
          onCerrar={() => setExportando(null)}
          onListo={setAviso}
        />
      )}

      {aviso && <Aviso mensaje={aviso} onCerrar={() => setAviso(null)} />}
    </>
  )
}
