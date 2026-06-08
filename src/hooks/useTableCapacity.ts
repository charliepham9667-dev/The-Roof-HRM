import { useMemo } from "react"
import { useWebFormReservations } from "@/hooks/useWebFormReservations"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import {
  computeSlotAllocations,
  summarizeDay,
  type DayCapacitySummary,
} from "@/lib/capacityModel"

const ICT_TZ = "Asia/Ho_Chi_Minh"
function getTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(new Date())
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

const EXCLUDED_STATUSES = new Set(["declined", "cancelled", "noshow"])

export interface UseTableCapacityResult extends DayCapacitySummary {
  isLoading: boolean
  dateIso: string
}

/**
 * Table-based capacity for a given date (default today). Merges the Supabase
 * web-form reservations with the Google Sheets CSV (phone / manual bookings),
 * de-duplicated, then runs them through the venue capacity model.
 */
export function useTableCapacity(dateIso?: string): UseTableCapacityResult {
  const { data: webFormAll = [], isLoading: webLoading } = useWebFormReservations()
  const { data: sheetAll = [], isLoading: sheetLoading } = useReservationsCsv()
  const targetIso = dateIso ?? getTodayIso()

  const summary = useMemo(() => {
    // Merge both sources, de-dupe by name+date+time
    const merged: CsvReservation[] = [...webFormAll]
    const seen = new Set(
      merged.map((r) => `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`),
    )
    for (const r of sheetAll) {
      const key = `${(r.name ?? "").toLowerCase()}|${r.dateOfReservation}|${(r.time ?? "").slice(0, 5)}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(r)
      }
    }

    const dayRows = merged.filter(
      (r) => r.dateOfReservation === targetIso && !EXCLUDED_STATUSES.has(r.bookingStatus ?? ""),
    )

    const slots = computeSlotAllocations(
      dayRows.map((r) => ({
        time: r.time,
        numberOfGuests: r.numberOfGuests,
        table: r.table,
        specialRequests: r.specialRequests,
        bookingStatus: r.bookingStatus,
      })),
    )
    return summarizeDay(slots)
  }, [webFormAll, sheetAll, targetIso])

  return {
    ...summary,
    isLoading: webLoading || sheetLoading,
    dateIso: targetIso,
  }
}
