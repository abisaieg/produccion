// Prueba de extremo a extremo usando el MISMO código que usa la app,
// contra la base real. Se ejecuta con: npx vite-node src/prueba-flujo.ts
import { supabase } from './lib/supabase'
import { db, duplicarConfig, duplicarProducto, traerCompletos } from './lib/datos'
import { deConfig } from './lib/tipos'
import { comoDetalle, crearOpcion } from './lib/biblioteca'

let fallos = 0
function chequear(ok: boolean, texto: string, detalle = '') {
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${texto}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

const { error: errLogin } = await supabase.auth.signInWithPassword({
  email: 'equipo@produccion.app',
  password: 'CREDENCIAL-ELIMINADA',
})
chequear(!errLogin, 'entrar con el PIN', errLogin?.message)

// ---------------------------------------------------------------- alta
const { data: prod } = await db.crearProducto({ nombre: 'PRUEBA borrar', estado: 'idea' })
const pid = prod!.id as string
chequear(!!pid, 'crear producto')

let [d] = await traerCompletos([pid])
chequear(d.configs.length === 1, 'el producto arranca con una versión', d.configs[0]?.nombre)
const cfg1 = d.configs[0].id

// ------------------------------------------------------- detalles (specs)
await db.agregar('especificaciones', { producto_id: pid, config_id: null, nombre: 'Packaging', orden: 0 })
await db.agregar('especificaciones', { producto_id: pid, config_id: cfg1, nombre: 'Tela', orden: 0 })
;[d] = await traerCompletos([pid])
chequear(d.specs.filter((s) => !s.config_id).length === 1, 'detalle general del producto')
chequear(deConfig(d.specs, cfg1).length === 1, 'detalle propio de la versión')

const specGeneral = d.specs.find((s) => !s.config_id)!
await db.actualizar('especificaciones', specGeneral.id, {
  valor: 'Bolsa de PVC con cierre', definido: true,
})
;[d] = await traerCompletos([pid])
const spec2 = d.specs.find((s) => s.id === specGeneral.id)!
chequear(spec2.valor === 'Bolsa de PVC con cierre' && spec2.definido, 'editar y marcar como definido')

// -------------------------------------------- biblioteca de opciones
// el caso real: 4 estilos que comparten el mismo packaging
const pack = await crearOpcion({
  tipo: 'Packaging', nombre: 'Bolsa PVC con cierre',
  detalle: 'logo impreso 2 colores', foto: null,
})
chequear(!!pack, 'cargar un packaging en la biblioteca')

const { opciones: bib } = await (async () => {
  const { data } = await supabase.from('opciones').select('*').eq('tipo', 'Packaging')
  return { opciones: (data ?? []) as typeof pack[] }
})()
chequear(bib.length >= 1, 'la biblioteca lo devuelve para reusar')

// elegirlo en el detalle copia nombre, valor y foto
const { data: specPack } = await db.agregar('especificaciones', {
  producto_id: pid, config_id: cfg1, nombre: 'Packaging', orden: 1,
})
await db.actualizar('especificaciones', specPack!.id, { ...comoDetalle(pack!), definido: true })
;[d] = await traerCompletos([pid])
const elegido = d.specs.find((s) => s.id === specPack!.id)!
chequear(elegido.opcion_id === pack!.id, 'el detalle recuerda de qué opción salió')
chequear(elegido.valor === 'Bolsa PVC con cierre — logo impreso 2 colores',
  'copia el nombre y el detalle de la opción', elegido.valor ?? '')

const { data: opRecontada } = await supabase.from('opciones').select('usos').eq('id', pack!.id).single()
chequear((opRecontada as { usos: number }).usos >= 1, 'cuenta los usos para ordenar por lo más elegido')

// --------------------------------------------------- medidas, colores, matriz
// alta de varias de una sola vez, como el "1 plaza, 2 plazas, King" de la pantalla
const { data: medidasNuevas } = await db.agregarVarias('medidas', [
  { producto_id: pid, config_id: cfg1, nombre: '2 plazas', precio_unit: 12.5, orden: 0 },
  { producto_id: pid, config_id: cfg1, nombre: 'King', precio_unit: 15, orden: 1 },
])
const { data: coloresNuevos } = await db.agregarVarias('colores', [
  { producto_id: pid, config_id: cfg1, nombre: 'Beige', orden: 0 },
  { producto_id: pid, config_id: cfg1, nombre: 'Azul', orden: 1 },
])
chequear((medidasNuevas ?? []).length === 2 && (coloresNuevos ?? []).length === 2,
  'cargar varias medidas y colores de una sola vez')
const m1 = (medidasNuevas as { id: string }[])[0]
const m2 = (medidasNuevas as { id: string }[])[1]
const c1 = (coloresNuevos as { id: string }[])[0]
const c2 = (coloresNuevos as { id: string }[])[1]

await db.setCantidad(pid, cfg1, m1.id, c1.id, 100)
await db.setCantidad(pid, cfg1, m1.id, c2.id, 50)
await db.setCantidad(pid, cfg1, m2.id, c1.id, 30)
// pisar una cantidad, como cuando corregís el número
await db.setCantidad(pid, cfg1, m1.id, c1.id, 450)

;[d] = await traerCompletos([pid])
const cant = (mid: string, cid: string) =>
  d.variantes.find((v) => v.medida_id === mid && v.color_id === cid)?.cantidad ?? 0
chequear(cant(m1.id, c1.id) === 450, 'corregir una cantidad la pisa, no duplica')
chequear(d.variantes.length === 3, 'quedan 3 celdas cargadas', `hay ${d.variantes.length}`)
const total = d.variantes.reduce((s, v) => s + v.cantidad, 0)
chequear(total === 530, 'total de unidades', `${total}`)

// ------------------------------------------------------- segunda versión
const { data: cfgB } = await db.agregar('configuraciones', { producto_id: pid, nombre: 'A rayas', orden: 1 })
const { data: m3 } = await db.agregar('medidas', { producto_id: pid, config_id: cfgB!.id, nombre: '1 plaza', orden: 0 })
const { data: c3 } = await db.agregar('colores', { producto_id: pid, config_id: cfgB!.id, nombre: 'Gris', orden: 0 })
await db.setCantidad(pid, cfgB!.id, m3!.id, c3!.id, 80)

;[d] = await traerCompletos([pid])
chequear(deConfig(d.medidas, cfg1).length === 2 && deConfig(d.medidas, cfgB!.id).length === 1,
  'cada versión tiene sus propias medidas')
chequear(deConfig(d.colores, cfgB!.id).length === 1, 'cada versión tiene sus propios colores')

// --------------------------------------------------- duplicar una versión
const copiaId = await duplicarConfig(pid, {
  config: d.configs.find((c) => c.id === cfg1)!,
  specs: deConfig(d.specs, cfg1),
  medidas: deConfig(d.medidas, cfg1),
  colores: deConfig(d.colores, cfg1),
  variantes: deConfig(d.variantes, cfg1),
  fotos: deConfig(d.fotos, cfg1),
}, 2)
;[d] = await traerCompletos([pid])
chequear(!!copiaId && d.configs.length === 3, 'duplicar una versión')
if (copiaId) {
  const copiaCant = deConfig(d.variantes, copiaId).reduce((s, v) => s + v.cantidad, 0)
  chequear(copiaCant === 530, 'la copia mantiene las cantidades', `${copiaCant}`)
  chequear(deConfig(d.medidas, copiaId).length === 2, 'la copia mantiene las medidas')
  // la matriz copiada debe apuntar a las medidas NUEVAS, no a las del original
  const idsCopia = new Set(deConfig(d.medidas, copiaId).map((m) => m.id))
  const bienMapeada = deConfig(d.variantes, copiaId).every((v) => idsCopia.has(v.medida_id))
  chequear(bienMapeada, 'la matriz de la copia apunta a sus propias medidas')
}

// -------------------------------------------------------- borrar cosas
await db.borrar('colores', c2.id)
;[d] = await traerCompletos([pid])
chequear(!d.colores.some((c) => c.id === c2.id), 'borrar un color')
chequear(!d.variantes.some((v) => v.color_id === c2.id), 'al borrar el color se van sus cantidades')

await db.borrar('medidas', m2.id)
await db.borrar('especificaciones', specGeneral.id)
await db.borrar('configuraciones', cfgB!.id)
;[d] = await traerCompletos([pid])
chequear(!d.medidas.some((m) => m.id === m2.id), 'borrar una medida')
chequear(!d.specs.some((s) => s.id === specGeneral.id), 'borrar un detalle')
chequear(d.configs.length === 2, 'borrar una versión entera')
chequear(!d.medidas.some((m) => m.config_id === cfgB!.id), 'la versión borrada se lleva sus medidas')

// ------------------------------------------------------ duplicar producto
const nuevoPid = await duplicarProducto(pid)
chequear(!!nuevoPid, 'duplicar el producto entero')
if (nuevoPid) {
  const [orig] = await traerCompletos([pid])
  const [copia] = await traerCompletos([nuevoPid])
  chequear(copia.configs.length === orig.configs.length,
    'la copia tiene las mismas versiones', `${copia.configs.length} vs ${orig.configs.length}`)
  const tOrig = orig.variantes.reduce((s, v) => s + v.cantidad, 0)
  const tCopia = copia.variantes.reduce((s, v) => s + v.cantidad, 0)
  chequear(tCopia === tOrig, 'la copia tiene las mismas cantidades', `${tCopia} vs ${tOrig}`)
  await db.borrarProducto(nuevoPid)
}

// -------------------------------------------------------- borrar producto
await db.borrarProducto(pid)
const quedan = await traerCompletos([pid])
chequear(quedan.length === 0, 'borrar el producto')

const { data: hijos } = await supabase.from('medidas').select('id').eq('producto_id', pid)
chequear((hijos ?? []).length === 0, 'borrar el producto se lleva todo lo suyo')

if (pack) await db.borrar('opciones', pack.id)

console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLAS`)
if (fallos > 0) throw new Error(`${fallos} verificaciones fallaron`)
