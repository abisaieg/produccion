import { supabase, BUCKET_URL } from './supabase'

const LADO_MAX = 1600
const CALIDAD = 0.82

/** Formatos que Excel puede incrustar en la planilla. */
const SIRVE_PARA_EXCEL = ['image/jpeg', 'image/png']

/**
 * Achica la imagen antes de subirla (el plan gratis trae 1 GB) y la deja en
 * un formato que Excel entienda.
 *
 * Lo segundo es tan importante como lo primero: un WebP se ve perfecto en la
 * app pero después no entra en el Excel que se le manda a la fábrica, y la
 * foto desaparece sin aviso.
 */
async function comprimir(file: File): Promise<Blob> {
  const yaSirve = SIRVE_PARA_EXCEL.includes(file.type)
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))

    // chica y en un formato que sirve: se sube tal cual
    if (escala === 1 && file.size < 400_000 && yaSirve) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // fondo blanco: los PNG con transparencia quedarían negros en JPEG
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', CALIDAD))
    if (!blob) return file
    // si el original ya servía y pesaba menos, nos quedamos con el original
    return yaSirve && blob.size >= file.size ? file : blob
  } catch {
    return file
  }
}

/**
 * Sube una imagen al bucket y devuelve su URL pública.
 *
 * Confirma que el archivo quedó realmente en el storage antes de devolver la
 * URL: si no, se guardaba en la base una foto que no existía y aparecía rota
 * en la app y ausente en el Excel.
 */
export async function subirFoto(file: File, carpeta = 'productos'): Promise<string> {
  const blob = await comprimir(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg'
    : blob.type === 'image/png' ? 'png'
    : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const nombre = `${carpeta}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('fotos').upload(nombre, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)

  const url = BUCKET_URL + nombre
  const check = await fetch(url, { method: 'HEAD' })
  if (!check.ok) throw new Error('La foto no quedó guardada, probá de nuevo')
  return url
}

/**
 * Borra del storage una imagen, pero solo si nadie más la está usando.
 *
 * Al copiar un detalle a otro diseño las filas comparten el mismo archivo:
 * si al borrar una se eliminara el archivo, las otras copias quedarían rotas.
 */
export async function borrarFoto(url: string) {
  if (!url.startsWith(BUCKET_URL)) return

  const [enFotos, enConfigs, enSpecs, enProds, enOpciones] = await Promise.all([
    supabase.from('fotos').select('id').eq('url', url),
    supabase.from('configuraciones').select('id').eq('foto', url),
    supabase.from('especificaciones').select('id').eq('foto', url),
    supabase.from('productos').select('id').eq('foto', url),
    supabase.from('opciones').select('id').eq('foto', url),
  ])

  const usos = [enFotos, enConfigs, enSpecs, enProds, enOpciones]
    .reduce((s, r) => s + (r.data?.length ?? 0), 0)

  // 1 uso es el que se está borrando ahora mismo; más de eso, se comparte
  if (usos > 1) return

  const ruta = url.slice(BUCKET_URL.length)
  await supabase.storage.from('fotos').remove([ruta])
}
