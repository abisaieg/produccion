// ¿Las fotos entran de verdad en el Excel? (colores, detalles y galería)
import { writeFileSync } from 'node:fs'
import { generarExcel } from './lib/excel'
import type { ProductoCompleto } from './lib/tipos'

const B = 'https://dfdulkxffygnglnncbun.supabase.co/storage/v1/object/public/fotos/prueba/'
const cfg = 'c1'

const p: ProductoCompleto = {
  producto: {
    id: 'p1', nombre: 'Acolchado', codigo: 'ACO-1', proveedor: 'Nantong', categoria: null,
    estado: 'cotizando', descripcion: null, pendiente: null, foto: B + 'pack.jpg',
    moneda: 'USD', archivado: false, orden: 0,
    created_at: '2026-07-30T10:00:00Z', updated_at: '2026-07-30T10:00:00Z',
  },
  configs: [{ id: cfg, producto_id: 'p1', nombre: 'Diseño 1', descripcion: null, foto: B + 'pack.jpg', orden: 0 }],
  specs: [{
    id: 's1', producto_id: 'p1', config_id: cfg, opcion_id: null, nombre: 'Packaging',
    valor: 'Bolsa PVC con cierre', foto: null, definido: true, orden: 0,
  }, {
    id: 's2', producto_id: 'p1', config_id: cfg, opcion_id: null, nombre: 'Insert',
    valor: 'Insert de cartón', foto: null, definido: false, orden: 1,
  }],
  fotos: [
    // tres imágenes del packaging, cada una con SU texto
    { id: 'f1', producto_id: 'p1', config_id: cfg, spec_id: 's1', url: B + 'pack.jpg', titulo: 'Frente', orden: 0 },
    { id: 'f2', producto_id: 'p1', config_id: cfg, spec_id: 's1', url: B + 'rojo.jpg', titulo: 'Dorso con logo', orden: 1 },
    { id: 'f3', producto_id: 'p1', config_id: cfg, spec_id: 's1', url: B + 'azul.jpg', titulo: 'Cierre', orden: 2 },
    // una del insert
    { id: 'f4', producto_id: 'p1', config_id: cfg, spec_id: 's2', url: B + 'pack.jpg', titulo: 'Ejemplo', orden: 0 },
    // y una suelta en la galería del estilo
    { id: 'f5', producto_id: 'p1', config_id: cfg, spec_id: null, url: B + 'rojo.jpg', titulo: 'Referencia general', orden: 0 },
  ],
  medidas: [{ id: 'm1', producto_id: 'p1', config_id: cfg, nombre: '2 plazas', detalle: '240x260', precio_unit: 12, orden: 0 }],
  colores: [
    { id: 'k1', producto_id: 'p1', config_id: cfg, nombre: 'Rojo', hex: '#c83c3c', foto: B + 'rojo.jpg', orden: 0 },
    { id: 'k2', producto_id: 'p1', config_id: cfg, nombre: 'Azul', hex: '#3c5ac8', foto: B + 'azul.jpg', orden: 1 },
  ],
  variantes: [
    { id: 'v1', producto_id: 'p1', config_id: cfg, medida_id: 'm1', color_id: 'k1', cantidad: 100, precio_unit: null, notas: null },
    { id: 'v2', producto_id: 'p1', config_id: cfg, medida_id: 'm1', color_id: 'k2', cantidad: 50, precio_unit: null, notas: null },
  ],
  notas: [],
}

const blob = await generarExcel([p], { conFotos: true, idioma: 'es' })
const buf = Buffer.from(await blob.arrayBuffer())
writeFileSync('/tmp/fotos.xlsx', buf)

const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('/tmp/fotos.xlsx')
const ficha = wb.worksheets[1]
const imgs = ficha.getImages()
console.log('imágenes embebidas en la ficha:', imgs.length)
// 1 producto + 3 del packaging + 1 del insert + 2 colores + 1 galería = 8
console.log(imgs.length >= 8 ? 'OK entran todas las imágenes' : `FALLA solo ${imgs.length} de 8`)

// los textos de cada imagen tienen que estar en la hoja
const textos: string[] = []
ficha.eachRow((row) => {
  row.eachCell((c) => { if (typeof c.value === 'string') textos.push(c.value) })
})
for (const t of ['Frente', 'Dorso con logo', 'Cierre']) {
  console.log(textos.includes(t) ? `OK texto "${t}"` : `FALLA falta el texto "${t}"`)
}
console.log('peso del archivo:', Math.round(buf.length / 1024), 'KB')
