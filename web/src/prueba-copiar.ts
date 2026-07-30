// ¿Copiar un detalle a otros diseños funciona, con sus imágenes y textos?
import { entrarConPin } from './lib/auth'
import { db, copiarSpecA, traerCompletos, traerDestinos } from './lib/datos'

let fallos = 0
const chequear = (ok: boolean, t: string, d = '') => {
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${t}${d ? ` — ${d}` : ''}`)
  if (!ok) fallos++
}

await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

const B = 'https://dfdulkxffygnglnncbun.supabase.co/storage/v1/object/public/fotos/prueba/'

// producto A con dos diseños; producto B con uno
const { data: pA } = await db.crearProducto({ nombre: 'PRUEBA copiar A' })
const { data: pB } = await db.crearProducto({ nombre: 'PRUEBA copiar B' })
const idA = pA!.id as string
const idB = pB!.id as string

let [dA] = await traerCompletos([idA])
const cfg1 = dA.configs[0].id
const { data: cfg2 } = await db.agregar('configuraciones', {
  producto_id: idA, nombre: 'Diseño 2', orden: 1,
})
const [dB] = await traerCompletos([idB])
const cfgB = dB.configs[0].id

// detalle con texto y dos imágenes con su texto
const { data: spec } = await db.agregar('especificaciones', {
  producto_id: idA, config_id: cfg1, nombre: 'Packaging',
  valor: 'Bolsa PVC con cierre', definido: true, orden: 0,
})
await db.agregarVarias('fotos', [
  { producto_id: idA, config_id: cfg1, spec_id: spec!.id, url: B + 'pack.jpg', titulo: 'Frente', orden: 0 },
  { producto_id: idA, config_id: cfg1, spec_id: spec!.id, url: B + 'rojo.jpg', titulo: 'Dorso', orden: 1 },
])

const destinos = await traerDestinos()
chequear(destinos.length >= 4, 'la lista de destinos trae los diseños', `${destinos.length}`)
chequear(destinos.some((d) => d.configNombre === 'Diseño 2'),
  'aparece el otro diseño del mismo producto')
chequear(destinos.some((d) => d.productoNombre === 'PRUEBA copiar B'),
  'aparecen los diseños de otros productos')

// copiar a: el otro diseño del mismo producto Y el diseño de otro producto
;[dA] = await traerCompletos([idA])
const original = dA.specs.find((s) => s.id === spec!.id)!
const imgs = dA.fotos.filter((f) => f.spec_id === spec!.id)
chequear(imgs.length === 2, 'el detalle original tiene sus dos imágenes')

await copiarSpecA(original, imgs.map((f) => ({ url: f.url, titulo: f.titulo })), [
  destinos.find((d) => d.configId === cfg2!.id)!,
  destinos.find((d) => d.configId === cfgB)!,
])

// verificar en el mismo producto
;[dA] = await traerCompletos([idA])
const enCfg2 = dA.specs.filter((s) => s.config_id === cfg2!.id)
chequear(enCfg2.length === 1 && enCfg2[0].nombre === 'Packaging',
  'el detalle llegó al otro diseño del mismo producto')
chequear(enCfg2[0]?.valor === 'Bolsa PVC con cierre', 'con su texto general')
const imgs2 = dA.fotos.filter((f) => f.spec_id === enCfg2[0]?.id)
chequear(imgs2.length === 2, 'con sus dos imágenes', `${imgs2.length}`)
chequear(imgs2.map((f) => f.titulo).sort().join(',') === 'Dorso,Frente',
  'y el texto de cada imagen')

// verificar en el otro producto
const [dB2] = await traerCompletos([idB])
const enB = dB2.specs.filter((s) => s.config_id === cfgB)
chequear(enB.length === 1, 'el detalle llegó al diseño de OTRO producto')
chequear(dB2.fotos.filter((f) => f.spec_id === enB[0]?.id).length === 2,
  'con sus imágenes también')

// el original no se tocó
chequear(dA.specs.filter((s) => s.config_id === cfg1).length === 1,
  'el original queda intacto')

await db.borrarProducto(idA)
await db.borrarProducto(idB)
console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLAS`)
if (fallos) throw new Error(`${fallos} fallas`)
