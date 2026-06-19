import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationClient, RESERVATION_FUNC_URL } from '@/lib/reservationClient'
import { supabase } from '@/lib/supabase'
import { insertNotifications } from './useNotifications'
import { useAuthStore } from '@/stores/authStore'
import type { CsvReservation, ReservationStatus } from './useReservationsCsv'

export type RespondType = 'confirm' | 'followup' | 'decline'

const ICT_TZ = 'Asia/Ho_Chi_Minh'

function getTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`
}

function getDateStatus(dateIso: string): ReservationStatus {
  const today = getTodayIso()
  if (dateIso === today) return 'today'
  if (dateIso > today) return 'upcoming'
  return 'past'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapSourceToOccasion(source: string | null): string {
  if (!source || UUID_RE.test(source)) return 'website'
  if (source === 'social_media') return 'whatsapp'
  return source
}

function parseTableZone(specialRequests: string | null): string | null {
  if (!specialRequests) return null
  const m = specialRequests.match(/\[Table preference:\s*([^\]]+)\]/i)
  return m ? m[1].trim() : null
}

function stripTableTag(specialRequests: string | null): string | null {
  if (!specialRequests) return null
  return specialRequests.replace(/\[Table preference:[^\]]*\]/i, '').trim() || null
}

// NOTE: the `reservations` table has NO `source` column. Including it makes the
// Supabase REST select error out, which silently returns [] for BOTH the active
// and declined queries — wiping Pending Approvals and Declined & Lost. Web form
// entries are website bookings by definition; phone/CSV entries are detected
// client-side via getBookingSource(). Do not add `source` here.
const FULL_SELECT =
  'id, name, phone, email, requested_date, requested_time, party_size, special_requests, package, package_paid, status, token, created_at, response_type, response_message, response_channels, responded_at'

function mapRow(row: any): CsvReservation {
  const dateIso = row.requested_date ?? ''
  const tableZone = parseTableZone(row.special_requests)
  return {
    submittedAt: row.created_at ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    name: row.name ?? null,
    table: tableZone,
    notes: null,
    dateOfReservation: dateIso,
    dateRaw: dateIso,
    time: row.requested_time ? row.requested_time.slice(0, 5) : null,
    numberOfGuests: row.party_size ?? 0,
    specialRequests: stripTableTag(row.special_requests),
    specialPackages: row.package ?? null,
    occasion: mapSourceToOccasion(row.source ?? null),
    mustHaves: null,
    status: getDateStatus(dateIso),
    bookingStatus: row.status ?? 'pending',
    reservationSystemId: row.id,
    reservationSystemToken: row.token,
    responseType: row.response_type ?? null,
    responseMessage: row.response_message ?? null,
    responseChannels: row.response_channels ?? null,
    respondedAt: row.responded_at ?? null,
    packagePaid: row.package_paid ?? false,
  }
}

// ─── Active reservations (today + upcoming) ───────────────────────────────────

export function useWebFormReservations() {
  return useQuery({
    queryKey: ['webform-reservations'],
    queryFn: async (): Promise<CsvReservation[]> => {
      if (!reservationClient) return []

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const pastCutoff = thirtyDaysAgo.toISOString().slice(0, 10)

      const { data, error } = await reservationClient
        .from('reservations')
        .select(FULL_SELECT)
        .gte('requested_date', pastCutoff)
        .order('requested_date', { ascending: true })
        .order('requested_time', { ascending: true })

      if (error) {
        console.error('[useWebFormReservations]', error)
        return []
      }

      return (data || []).map(mapRow)
    },
    refetchInterval: 60000,
    staleTime: 30000,
  })
}

// ─── Declined / cancelled / no-show log ──────────────────────────────────────

export function useDeclinedReservations() {
  return useQuery({
    queryKey: ['declined-reservations'],
    queryFn: async (): Promise<CsvReservation[]> => {
      if (!reservationClient) return []

      const { data, error } = await reservationClient
        .from('reservations')
        .select(FULL_SELECT)
        .in('status', ['declined', 'cancelled', 'noshow'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[useDeclinedReservations]', error)
        return []
      }

      return (data || []).map(mapRow)
    },
    staleTime: 30000,
  })
}

// ─── Cancel a web-form reservation (with reason → Declined & Lost) ───────────

export function useCancelReservation() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async ({
      id,
      reason,
      name,
      date,
      time,
      pax,
    }: {
      id: string
      reason: string
      name?: string | null
      date?: string | null
      time?: string | null
      pax?: number
    }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')

      // Soft-cancel: keep the row so it surfaces in the Declined & Lost log,
      // store the reason in response_message (same field the decline flow uses).
      const { error } = await reservationClient
        .from('reservations')
        .update({
          status: 'cancelled',
          response_message: reason,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error

      // Notify owners + managers so they can see why it was cancelled
      try {
        const { data: recipients } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['owner', 'manager'])

        if (recipients && recipients.length > 0) {
          const by = profile?.fullName ? ` by ${profile.fullName}` : ''
          const meta = [date, time, pax != null ? `${pax} pax` : null].filter(Boolean).join(' · ')
          await insertNotifications(
            recipients.map((r) => ({
              userId: r.id,
              title: `Reservation cancelled: ${name ?? 'Guest'}${by}`,
              body: `${meta ? meta + ' — ' : ''}Reason: ${reason}`,
              notificationType: 'general' as const,
              relatedType: 'reservation',
              relatedId: id,
            })),
          )
        }
      } catch (err) {
        console.warn('[useCancelReservation] notification fan-out failed:', err)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webform-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['declined-reservations'] })
    },
  })
}

// ─── Accept / Decline (simple, no message) ───────────────────────────────────

export function useAcceptReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, token }: { id: string; token: string }) => {
      if (!RESERVATION_FUNC_URL) throw new Error('Reservation function URL not configured')
      const res = await fetch(`${RESERVATION_FUNC_URL}/handle-decision?id=${id}&token=${token}&action=accepted`)
      if (!res.ok) throw new Error('Failed to accept reservation')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webform-reservations'] }),
  })
}

export function useDeclineReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, token }: { id: string; token: string }) => {
      if (!RESERVATION_FUNC_URL) throw new Error('Reservation function URL not configured')
      const res = await fetch(`${RESERVATION_FUNC_URL}/handle-decision?id=${id}&token=${token}&action=declined`)
      if (!res.ok) throw new Error('Failed to decline reservation')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webform-reservations'] }),
  })
}

// ─── Respond to guest (confirm / follow-up / decline + send message) ─────────

export function useRespondToGuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      token,
      type,
      message,
      reason,
      channels,
    }: {
      id: string
      token: string
      type: RespondType
      message: string
      reason?: string
      channels: string[]
    }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')
      const { error } = await reservationClient.functions.invoke('respond-to-guest', {
        body: { id, token, type, message, reason: reason ?? '', channels },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webform-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['declined-reservations'] })
    },
  })
}

// ─── Send reminder email ──────────────────────────────────────────────────────

export function useSendReminder() {
  return useMutation({
    mutationFn: async ({ id, token }: { id: string; token: string }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')
      const { error } = await reservationClient.functions.invoke('send-reminder', {
        body: { id, token },
      })
      if (error) throw error
    },
  })
}

// ─── Send a custom follow-up message ─────────────────────────────────────────

export function useSendGuestMessage() {
  return useMutation({
    mutationFn: async ({
      id,
      token,
      body,
      channel,
    }: {
      id: string
      token: string
      body: string
      channel: 'email' | 'whatsapp'
    }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')
      const { error } = await reservationClient.functions.invoke('send-guest-message', {
        body: { id, token, body, channel },
      })
      if (error) throw error
    },
  })
}

// ─── Mark package payment received ───────────────────────────────────────────

export function useMarkPackagePaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')
      const { error } = await reservationClient
        .from('reservations')
        .update({ package_paid: paid })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webform-reservations'] }),
  })
}
