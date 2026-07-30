import { supabase } from './supabase'

export type Idioma = 'es' | 'en' | 'ambos'

/** Mapa texto original -> traducción al inglés. */
export type Traducciones = Map<string, string>

/**
 * Traduce los textos al inglés vía Edge Function (Claude + cache en la base).
 * Si el servicio no está disponible devuelve el texto tal cual: el Excel sale
 * igual, solo que en español.
 */
export async function traducir(textos: (string | null | undefined)[]): Promise<Traducciones> {
  const limpios = [...new Set(
    textos.map((t) => (t ?? '').trim()).filter((t) => t.length > 0),
  )]
  const mapa: Traducciones = new Map()
  if (!limpios.length) return mapa

  try {
    const { data, error } = await supabase.functions.invoke('traducir', {
      body: { textos: limpios },
    })
    if (error) throw error
    if (data && typeof data === 'object' && !('error' in data)) {
      for (const [es, en] of Object.entries(data as Record<string, string>)) {
        mapa.set(es, en)
      }
    }
  } catch {
    // sin traducción: se usa el original
  }
  return mapa
}

export function hayTraduccion(mapa: Traducciones) {
  return mapa.size > 0
}
