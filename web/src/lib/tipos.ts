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

/**
 * Una versión del producto: el mismo acolchado a cuadros y a rayas.
 * Cada una lleva sus propias medidas, colores, cantidades, precios y fotos.
 */
export interface Configuracion {
  id: string
  producto_id: string
  nombre: string
  descripcion: string | null
  foto: string | null
  orden: number
}

/**
 * Una opción guardada en la biblioteca para reusar: un packaging, un tipo de
 * insert, una tela. Se carga una vez con su foto y después se elige.
 */
export interface Opcion {
  id: string
  tipo: string
  nombre: string
  detalle: string | null
  foto: string | null
  usos: number
}

export interface Especificacion {
  id: string
  producto_id: string
  /** null = detalle general del producto; con valor = detalle de esa configuración */
  config_id: string | null
  /** de qué opción de la biblioteca salió, si salió de una */
  opcion_id: string | null
  nombre: string
  valor: string | null
  foto: string | null
  definido: boolean
  orden: number
}

export interface Foto {
  id: string
  producto_id: string
  config_id: string | null
  /** si tiene valor, la imagen pertenece a ese detalle y no a la galería */
  spec_id: string | null
  url: string
  /** el texto propio de esta imagen */
  titulo: string | null
  orden: number
}

export interface Medida {
  id: string
  producto_id: string
  config_id: string | null
  nombre: string
  detalle: string | null
  precio_unit: number | null
  orden: number
}

export interface Color {
  id: string
  producto_id: string
  config_id: string | null
  nombre: string
  hex: string | null
  foto: string | null
  orden: number
}

export interface Variante {
  id: string
  producto_id: string
  config_id: string | null
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
  configs: Configuracion[]
  specs: Especificacion[]
  fotos: Foto[]
  medidas: Medida[]
  colores: Color[]
  variantes: Variante[]
  notas: Nota[]
}

/** Filtra los hijos que pertenecen a una configuración. */
export function deConfig<T extends { config_id: string | null }>(
  lista: T[],
  configId: string,
): T[] {
  return lista.filter((x) => x.config_id === configId)
}

/** Las fotos de la galería del estilo: las que no cuelgan de un detalle. */
export function galeriaDe(fotos: Foto[], configId: string): Foto[] {
  return fotos.filter((f) => f.config_id === configId && !f.spec_id)
}

/**
 * Detalles que se crean solos con cada estilo, ya listos para cargarles la
 * foto. Antes había que descubrir el panel de chips y agregarlos a mano, y
 * no se entendía que las fotos venían después. Se borran si no hacen falta.
 */
export const SPECS_INICIALES = ['Packaging', 'Insert']

/**
 * Medidas listas para agregar de un toque. Solo el nombre: los centímetros
 * los define cada pedido con su fábrica, en la misma fila de la medida.
 */
export const MEDIDAS_SUGERIDAS: { grupo: string; nombre: string }[] = [
  { grupo: 'Internacionales', nombre: 'Twin' },
  { grupo: 'Internacionales', nombre: 'Twin XL' },
  { grupo: 'Internacionales', nombre: 'Full' },
  { grupo: 'Internacionales', nombre: 'Queen' },
  { grupo: 'Internacionales', nombre: 'King' },
  { grupo: 'Internacionales', nombre: 'Super King' },
  { grupo: 'Argentinas', nombre: '1 plaza' },
  { grupo: 'Argentinas', nombre: '1 plaza y media' },
  { grupo: 'Argentinas', nombre: '2 plazas' },
]

/** Colores que se repiten pedido a pedido. */
export const COLORES_SUGERIDOS = [
  'Blanco', 'Crudo', 'Beige', 'Tostado', 'Gris', 'Gris oscuro',
  'Negro', 'Azul', 'Verde oliva', 'Rosa viejo',
]

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
