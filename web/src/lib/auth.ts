import { supabase } from './supabase'

// El acceso es por PIN. Por dentro se traduce a un usuario de Supabase Auth
// (los signups estan cerrados, asi que solo entra quien sabe el PIN).
// La sal sale de `web/.env`, que no se versiona.
const EMAIL = 'equipo@produccion.app'
const SAL = import.meta.env.VITE_PIN_SAL

export async function entrarConPin(pin: string) {
  if (!SAL) throw new Error('Falta VITE_PIN_SAL: copiá .env.example a .env')
  const { error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: pin + SAL,
  })
  if (error) throw new Error('PIN incorrecto')
}

export async function haySesion() {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export async function salir() {
  await supabase.auth.signOut()
}
