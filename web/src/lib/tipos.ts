export type Estado = 'idea' | 'cotizando' | 'aprobado' | 'produccion' | 'cerrado'

export const ESTADOS: { valor: Estado; texto: string; clase: string }[] = [
  { valor: 'idea', texto: 'Idea', clase: 'bg-neutral-100 text-neutral-600 border-neutral-300' },
  { valor: 'cotizando', texto: 'Cotizando', clase: 'bg-amber-50 text-amber-800 border-amber-300' },
  { valor: 'aprobado', texto: 'Aprobado', clase: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  { valor: 'produccion', texto: 'En producción', clase: 'bg-violet-50 text-violet-800 border-violet-300' },
  { valor: 'cerrado', texto: 'Cerrado', clase: 'bg-neutral-900 text-white border-neutral-900' },
]

export function estadoInfo(e: string) {
  return ESTADOS.find((x) => x.valor === e) ?? ESTADOS[0]
}

/** Los estados salen fijos en inglés, no pasan por el traductor. */
export const ESTADO_EN: Record<string, string> = {
  idea: 'Concept',
  cotizando: 'Quoting',
  aprobado: 'Approved',
  produccion: 'In production',
  cerrado: 'Closed',
}

export interface Producto {
  id: string
  nombre: string
  codigo: string | null
  proveedor: string | null
  categoria: string | null
  estado: Estado
  descripcion: string | null
  pendiente: string | null
  foto: string | null
  moneda: string
  archivado: boolean
  orden: number
  created_at: string
  updated_at: string
}

export interface Especificacion {
  id: string
  producto_id: string
  nombre: string
  valor: string | null
  foto: string | null
  definido: boolean
  orden: number
}

export interface Foto {
  id: string
  producto_id: string
  url: string
  titulo: string | null
  orden: number
}

export interface Medida {
  id: string
  producto_id: string
  nombre: string
  detalle: string | null
  precio_unit: number | null
  orden: number
}

export interface Color {
  id: string
  producto_id: string
  nombre: string
  hex: string | null
  foto: string | null
  orden: number
}

export interface Variante {
  id: string
  producto_id: string
  medida_id: string
  color_id: string
  cantidad: number
  precio_unit: number | null
  notas: string | null
}

export interface Nota {
  id: string
  producto_id: string
  texto: string
  autor: string | null
  created_at: string
}

export interface ProductoCompleto {
  producto: Producto
  specs: Especificacion[]
  fotos: Foto[]
  medidas: Medida[]
  colores: Color[]
  variantes: Variante[]
  notas: Nota[]
}

// Especificaciones que se sugieren al crear un producto nuevo.
// Son solo un punto de partida: se editan, se borran y se agregan las que quieras.
export const SPECS_SUGERIDAS = [
  'Material / tela',
  'Gramaje',
  'Relleno',
  'Insert',
  'Packaging',
  'Bolsa',
  'Etiqueta / marca',
  'Costura / terminación',
  'Certificados',
  'Unidades por bulto',
]
