import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Secondary Supabase client pointing at the reservation system project
// (separate from the HRM's own Supabase project)
// Env vars: VITE_RESERVATION_SUPABASE_URL + VITE_RESERVATION_SUPABASE_ANON_KEY

const url = import.meta.env.VITE_RESERVATION_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_RESERVATION_SUPABASE_ANON_KEY as string | undefined

// Kept ONLY for `.functions.invoke(...)` calls (send-inbox-message and friends).
// Invoking an edge function authenticates with the anon key, which is unaffected
// by table grants.
//
// Do NOT add new `.from('table')` reads through this client. Reads go via
// gatewayFetch below. Every direct table read from here arrives at the
// reservation project as `anon`, because an HRM session token is issued by the
// HRM project and carries no meaning there — which is exactly why that
// project's guest data was world-readable. See
// reservation-system/anon-lockdown-phase2.md.
export const reservationClient = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false, lock: <R>(_n: string, _t: number, fn: () => Promise<R>) => fn() } })
  : null

export const RESERVATION_FUNC_URL = url
  ? `${url}/functions/v1`
  : null

/**
 * Read reservation-project data through the hrm-gateway edge function.
 *
 * The gateway verifies this HRM access token against the HRM project, then
 * queries with the reservation project's service_role key. That is what lets
 * anon SELECT be revoked there without breaking the dashboard.
 *
 * Returns null when unconfigured or when the caller has no HRM session, so
 * callers can fall back to an empty result exactly as they did before.
 */
export async function gatewayFetch<T>(
  action: string,
  params: Record<string, string | null | undefined> = {},
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<T | null> {
  if (!RESERVATION_FUNC_URL) return null

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  const qs = new URLSearchParams({ action })
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, v)
  }

  const res = await fetch(`${RESERVATION_FUNC_URL}/hrm-gateway?${qs}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  if (!res.ok) {
    console.error('[gatewayFetch]', action, res.status, await res.text().catch(() => ''))
    return null
  }
  return (await res.json()) as T
}
