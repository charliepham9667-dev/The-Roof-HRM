import { useQuery } from '@tanstack/react-query'
import { reservationClient } from '@/lib/reservationClient'

const ICT_TZ = 'Asia/Ho_Chi_Minh'

function getTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`
}

export interface CapacitySlot {
  time: string    // "19:00"
  hour: number    // 19
  booked: number  // total accepted pax in this slot
  maxPax: number  // cap from time_slot_caps
}

export interface CapacityConfig {
  warningThreshold: number
  hardLimit: number        // auto_close_threshold
}

export interface CapacityData {
  slots: CapacitySlot[]
  config: CapacityConfig
}

export function useCapacityData() {
  return useQuery({
    queryKey: ['capacity-data'],
    queryFn: async (): Promise<CapacityData> => {
      if (!reservationClient) {
        return { slots: [], config: { warningThreshold: 35, hardLimit: 45 } }
      }

      const today = getTodayIso()

      // Fetch all three in parallel
      const [slotCapsRes, settingsRes, reservationsRes] = await Promise.all([
        reservationClient
          .from('time_slot_caps')
          .select('slot_hour, max_pax')
          .order('slot_hour', { ascending: true }),
        reservationClient
          .from('reservation_settings')
          .select('key, value'),
        reservationClient
          .from('reservations')
          .select('requested_time, party_size, status')
          .eq('requested_date', today)
          .in('status', ['accepted', 'pending']),
      ])

      // Parse config
      const settingsMap: Record<string, string> = {}
      for (const row of settingsRes.data || []) {
        settingsMap[row.key] = row.value
      }
      const config: CapacityConfig = {
        warningThreshold: parseInt(settingsMap['warning_threshold'] ?? '20', 10),
        hardLimit: parseInt(settingsMap['auto_close_threshold'] ?? '50', 10),
      }

      // Aggregate bookings by hour
      const bookedByHour: Record<number, number> = {}
      for (const r of reservationsRes.data || []) {
        const hour = parseInt((r.requested_time ?? '00:00').slice(0, 2), 10)
        bookedByHour[hour] = (bookedByHour[hour] ?? 0) + (r.party_size ?? 0)
      }

      // Build slots
      const slots: CapacitySlot[] = (slotCapsRes.data || []).map((row) => ({
        hour: row.slot_hour,
        time: `${String(row.slot_hour).padStart(2, '0')}:00`,
        booked: bookedByHour[row.slot_hour] ?? 0,
        maxPax: row.max_pax,
      }))

      return { slots, config }
    },
    refetchInterval: 60000,
    staleTime: 30000,
  })
}
