// ¿La conexión "en vivo" (Realtime) realmente avisa de los cambios?
import { supabase } from './lib/supabase'
import { entrarConPin } from './lib/auth'

// El PIN sale de `web/.env` (VITE_PIN_PRUEBA), igual que la sal. Nada de credenciales acá.
await entrarConPin(import.meta.env.VITE_PIN_PRUEBA)

let avisos = 0
const canal = supabase
  .channel('prueba-vivo')
  .on('postgres_changes', { event: '*', schema: 'public' }, (m) => {
    avisos++
    console.log('  aviso recibido:', m.eventType, (m as { table?: string }).table)
  })

const estado = await new Promise<string>((res) => {
  canal.subscribe((s) => { console.log('  estado del canal:', s); if (s !== 'SUBSCRIBED') res(s) })
  setTimeout(() => res('SUBSCRIBED'), 4000)
})
console.log('suscripción:', estado)

const { data } = await supabase.from('productos').insert({ nombre: 'PRUEBA vivo' }).select().single()
await new Promise((r) => setTimeout(r, 3000))
await supabase.from('productos').delete().eq('id', data!.id)
await new Promise((r) => setTimeout(r, 3000))

console.log(avisos > 0
  ? `\nEL VIVO ANDA (${avisos} avisos)`
  : '\nEL VIVO NO AVISA NADA — la pantalla no se entera de los cambios')
supabase.removeChannel(canal)
