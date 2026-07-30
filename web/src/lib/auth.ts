import { supabase } from './supabase'

// El acceso es por PIN. Por dentro se traduce a un usuario de Supabase Auth
// (los signups estan cerrados, asi que solo entra quien sabe el PIN).
const EMAIL = 'equipo@produccion.app'
const SAL = 'CREDENCIAL-ELIMINADA'

export async function entrarConPin(pin: string) {
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
