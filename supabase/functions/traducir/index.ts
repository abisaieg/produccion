// Traduce al ingles los textos que el usuario carga en las fichas de producto,
// para que el Excel que se le manda a la fabrica se entienda del otro lado.
// Cachea en la tabla `traducciones` asi el mismo texto no se paga dos veces.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

/** hash estable del texto, para la clave del cache */
async function hashear(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function leerCache(hashes: string[]): Promise<Map<string, string>> {
  if (!hashes.length) return new Map()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/traducciones?hash=in.(${hashes.join(',')})&select=hash,en`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )
  if (!res.ok) return new Map()
  const filas = await res.json() as { hash: string; en: string }[]
  return new Map(filas.map((f) => [f.hash, f.en]))
}

async function guardarCache(filas: { hash: string; es: string; en: string }[]) {
  if (!filas.length) return
  await fetch(`${SUPABASE_URL}/rest/v1/traducciones`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(filas),
  })
}

const SYSTEM = `Sos traductor tecnico de un importador argentino de blanqueria y textil
para el hogar que compra a fabricas chinas. Traducis del espanol rioplatense al ingles
comercial que usan las fabricas en fichas tecnicas y ordenes de compra.

Reglas:
- Es traduccion, no explicacion. No agregues aclaraciones ni cambies el sentido.
- Mantene numeros, medidas y unidades tal cual (240 x 260 cm queda igual).
- Si el texto ya esta en ingles, devolvelo igual.
- Usa la terminologia estandar de la industria, no la traduccion literal.

Glosario obligatorio (espanol rioplatense -> ingles de fabrica):
- acolchado -> comforter (NUNCA "quilted pattern")
- cubrecama -> bedspread / coverlet
- colcha -> quilt
- sabana -> bed sheet; sabana ajustable -> fitted sheet; sabana encimera -> flat sheet
- funda / almohadon -> pillowcase / cushion cover
- juego de sabanas -> sheet set
- vellon siliconado -> siliconized hollow fiber filling
- relleno -> filling; gramaje -> GSM (grams per square meter)
- plumon -> down; sintetico -> synthetic
- tela / tejido -> fabric; hilado -> yarn; hilo -> thread
- microfibra -> microfiber; percal -> percale; tusor -> shantung; jacquard -> jacquard
- estampado -> printed; liso -> solid; a cuadros -> checkered / plaid; a rayas -> striped
- bordado -> embroidery; ribete / vivo -> piping; dobladillo -> hem
- costura -> stitching; pespunte -> topstitch; puntadas por pulgada -> stitches per inch
- cierre / cremallera -> zipper; broche -> snap button; velcro -> hook and loop
- bolsa de PVC -> PVC bag; bolsa transparente -> clear polybag
- insert -> insert (se deja igual, es el cartón/inserto del packaging)
- etiqueta de marca -> brand label; etiqueta de cuidado -> care label
- caja master / bulto -> master carton; unidades por bulto -> units per carton
- muestra -> sample; contramuestra -> counter sample

Medidas de cama argentinas (traducir al estandar internacional, conservando el nombre local
entre parentesis solo si aporta): 1 plaza -> Twin / Single; 1 plaza y media -> Twin XL;
2 plazas -> Full / Double; Queen -> Queen; King -> King; Super King -> Super King.
Nunca traduzcas "plaza" como "seater" ni "place".`

async function traducirConClaude(textos: string[]): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content:
          'Devolve la traduccion al ingles de cada uno de estos textos, en el mismo orden.\n\n' +
          textos.map((t, i) => `[${i}] ${t}`).join('\n'),
      }],
      tools: [{
        name: 'devolver_traducciones',
        description: 'Devuelve las traducciones al ingles en el mismo orden en que se recibieron.',
        input_schema: {
          type: 'object',
          properties: {
            traducciones: {
              type: 'array',
              items: { type: 'string' },
              description: 'Una traduccion por cada texto recibido, en el mismo orden.',
            },
          },
          required: ['traducciones'],
        },
      }],
      tool_choice: { type: 'tool', name: 'devolver_traducciones' },
    }),
  })

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const bloque = data.content?.find((c: { type: string }) => c.type === 'tool_use')
  const salida = bloque?.input?.traducciones as string[] | undefined
  if (!salida) throw new Error('Respuesta inesperada del modelo')
  // si vuelve de largo distinto, completamos con el original para no desalinear
  return textos.map((t, i) => salida[i] ?? t)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { textos } = await req.json() as { textos: string[] }
    const unicos = [...new Set((textos ?? []).map((t) => (t ?? '').trim()).filter(Boolean))]
    if (!unicos.length) return Response.json({}, { headers: CORS })

    const hashes = await Promise.all(unicos.map(hashear))
    const cache = await leerCache(hashes)

    const faltan: string[] = []
    const faltanHash: string[] = []
    unicos.forEach((t, i) => {
      if (!cache.has(hashes[i])) { faltan.push(t); faltanHash.push(hashes[i]) }
    })

    if (faltan.length) {
      // de a 60 para no pasarnos de contexto ni de max_tokens
      for (let i = 0; i < faltan.length; i += 60) {
        const lote = faltan.slice(i, i + 60)
        const loteHash = faltanHash.slice(i, i + 60)
        const traducidos = await traducirConClaude(lote)
        const filas = lote.map((es, j) => ({ hash: loteHash[j], es, en: traducidos[j] }))
        await guardarCache(filas)
        filas.forEach((f) => cache.set(f.hash, f.en))
      }
    }

    const salida: Record<string, string> = {}
    unicos.forEach((t, i) => { salida[t] = cache.get(hashes[i]) ?? t })
    return Response.json(salida, { headers: CORS })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS },
    )
  }
})
