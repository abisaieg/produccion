import { supabase, BUCKET_URL } from './supabase'

const LADO_MAX = 1600
const CALIDAD = 0.82

/**
 * Achica la imagen antes de subirla (el plan gratis trae 1 GB).
 * Si el navegador no la puede decodificar — HEIC de iPhone en Chrome, por
 * ejemplo — se sube el original sin tocar.
 */
async function comprimir(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && file.size < 400_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', CALIDAD))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Sube una imagen al bucket y devuelve su URL pública. */
export async function subirFoto(file: File, carpeta = 'productos'): Promise<string> {
  const blob = await comprimir(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const nombre = `${carpeta}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('fotos').upload(nombre, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)
  return BUCKET_URL + nombre
}

/** Borra del storage una imagen a partir de su URL pública. */
export async function borrarFoto(url: string) {
  if (!url.startsWith(BUCKET_URL)) return
  const ruta = url.slice(BUCKET_URL.length)
  await supabase.storage.from('fotos').remove([ruta])
}
