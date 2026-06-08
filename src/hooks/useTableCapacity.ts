import { useMemo } from "react"
import { useWebFormReservations } from "@/hooks/useWebFormReservations"
import { useReservationsCsv, type CsvReservation } from "@/hooks/useReservationsCsv"
import { useReservations } from "@/hooks/useReservations"
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

function offsetIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Map HRM status values to CsvReservation bookingStatus
function mapHrmStatus(status: string | undefined): CsvReservation["bookingStatus"] {
  switch (status) {
    case "confirmed":
    case "seated": return "accepted"
    case "pending":   return "pending"
    case "cancelled": return "cancelled"
    case "declined":  return "declined"
    case "noshow":
    case "no_show":   return "noshow"
    default:          return "accepted"
  }
}

const EXCLUDED_STATUSES = new Set(["declined", "cancelled", "noshow"])

export interface UseTableCapacityResult extends DayCapacitySummary {
  isLoading: boolean
  dateIso: string
  dayRows: CsvReservation[]
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

  // Pull HRM-entered reservations (phone bookings added via the "+" button).
  // Query a 60-day window centred on today so we always cover `targetIso`.
  const rangeStart = offsetIso(targetIso, -30)
  const rangeEnd   = offsetIso(targetIso,  30)
  const { data: hrmAll = [], isLoading: hrmLoading } = useReservations(rangeStart, rangeEnd)

  const summary = useMemo(() => {
    // Merge all three sources, de-dupe by name+date+time (lower-cased)
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
    // Normalise HRM Reservation → CsvReservation and merge
    for (const r of hrmAll) {
      const dateIsoValue = r.reservationDate ?? null           // already YYYY-MM-DD
      const timeValue    = (r.reservationTime ?? "").slice(0, 5) // HH:MM
      const key = `${(r.customerName ?? "").toLowerCase()}|${dateIsoValue}|${timeValue}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push({
          submittedAt:    r.createdAt ?? null,
          email:          r.customerEmail ?? null,
          phone:          r.customerPhone ?? null,
          name:           r.customerName ?? null,
          table:          r.tablePreference ?? null,
          notes:          r.notes ?? null,
          dateOfReservation: dateIsoValue,
          dateRaw:        dateIsoValue,
          time:           r.reservationTime ?? null,
          numberOfGuests: r.partySize ?? 0,
          specialRequests: r.specialRequests ?? null,
          specialPackages: null,
          occasion:       null,
          mustHaves:      null,
          status:         dateIsoValue === targetIso ? "today" : (dateIsoValue && dateIsoValue < targetIso ? "past" : "upcoming"),
          bookingStatus:  mapHrmStatus(r.status),
          reservationSystemId: r.id,
        })
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
    return { ...summarizeDay(slots), dayRows }
  }, [webFormAll, sheetAll, hrmAll, targetIso])

  return {
    ...summary,
    isLoading: webLoading || sheetLoading || hrmLoading,
    dateIso: targetIso,
  }
}
