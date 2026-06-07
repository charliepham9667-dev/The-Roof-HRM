import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationClient, RESERVATION_FUNC_URL } from '@/lib/reservationClient'
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

function mapSourceToOccasion(source: string | null): string {
  if (!source) return 'website'
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

const FULL_SELECT =
  'id, name, phone, email, requested_date, requested_time, party_size, special_requests, package, status, token, source, created_at, response_type, response_message, response_channels, responded_at'

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
