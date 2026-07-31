// Al agregar una medida conocida, ¿viene con sus centímetros?
import { entrarConPin } from './lib/auth'
import { db, traerCompletos } from './lib/datos'
import { MEDIDAS_SUGERIDAS } from './lib/tipos'

let fallos = 0
const chequear = (ok: boolean, t: string, d = '') => {
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!ok) fallos++
}

await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

const { data: prod } = await db.crearProducto({ nombre: 'PRUEBA medidas' })
const pid = prod!.id as string
const [d0] = await traerCompletos([pid])
const cfg = d0.configs[0].id

// como hace la pantalla: los nombres elegidos con los chips más uno escrito
const elegidas = ['Twin', 'Queen', 'King', 'Medida rara']
await db.agregarVarias('medidas', elegidas.map((nombre, i) => ({
  producto_id: pid, config_id: cfg, nombre, orden: i,
})))

const [d] = await traerCompletos([pid])
chequear(d.medidas.length === 4, 'se crean las 4 medidas', `${d.medidas.length}`)
chequear(elegidas.every((n) => d.medidas.some((m) => m.nombre === n)),
  'se crean con el nombre elegido')
chequear(d.medidas.every((m) => !m.detalle),
  'sin centímetros: el tamaño lo completás vos en la fila')
chequear(MEDIDAS_SUGERIDAS.some((m) => m.nombre === 'Queen'),
  'Twin, Queen y King están entre las sugeridas')

await db.borrarProducto(pid)
console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLAS`)
if (fallos) throw new Error('fallas')
