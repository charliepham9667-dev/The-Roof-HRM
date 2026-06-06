import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationClient, RESERVATION_FUNC_URL } from '@/lib/reservationClient'
import type { CsvReservation, ReservationStatus } from './useReservationsCsv'

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
  }
}

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
        .select('id, name, phone, email, requested_date, requested_time, party_size, special_requests, package, status, token, source, created_at')
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
