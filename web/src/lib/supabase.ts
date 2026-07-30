import { createClient } from '@supabase/supabase-js'

const URL = 'https://dfdulkxffygnglnncbun.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmZHVsa3hmZnlnbmdsbm5jYnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MzU1NTQsImV4cCI6MjEwMTAxMTU1NH0.cFaCYFEpNLsaQrjzFAcLR64AmbeGkV4Mg_278oumsrk'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const BUCKET_URL = `${URL}/storage/v1/object/public/fotos/`
