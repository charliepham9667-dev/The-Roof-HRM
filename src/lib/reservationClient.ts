import { createClient } from '@supabase/supabase-js'

// Secondary Supabase client pointing at the reservation system project
// (separate from the HRM's own Supabase project)
// Env vars: VITE_RESERVATION_SUPABASE_URL + VITE_RESERVATION_SUPABASE_ANON_KEY

const url = import.meta.env.VITE_RESERVATION_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_RESERVATION_SUPABASE_ANON_KEY as string | undefined

export const reservationClient = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null

export const RESERVATION_FUNC_URL = url
  ? `${url}/functions/v1`
  : null
