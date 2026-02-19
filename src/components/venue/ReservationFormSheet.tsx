import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useCreateReservation, useUpdateReservation } from "@/hooks/useReservations"
import type { Reservation, CreateReservationInput, ReservationSource } from "@/types"

// ─── Source options ────────────────────────────────────────────────────────────

const SOURCES: Array<{ value: ReservationSource; label: string; color: string }> = [
  { value: "phone",        label: "Phone",     color: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30" },
  { value: "website",      label: "Website",   color: "bg-[#3b82f6]/15 text-[#1e40af] border-[#3b82f6]/30" },
  { value: "social_media", label: "WhatsApp",  color: "bg-[#10b981]/15 text-[#065f46] border-[#10b981]/30" },
  { value: "walk_in",      label: "Walk-in",   color: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30" },
  { value: "email",        label: "Email",     color: "bg-[#8b5cf6]/15 text-[#5b21b6] border-[#8b5cf6]/30" },
]

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", color: "bg-[#10b981]/15 text-[#065f46] border-[#10b981]/30" },
  { value: "pending",   label: "Pending",   color: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30" },
  { value: "seated",    label: "Seated",    color: "bg-[#3b82f6]/15 text-[#1e40af] border-[#3b82f6]/30" },
  { value: "no_show",   label: "No Show",   color: "bg-[#ef4444]/15 text-[#991b1b] border-[#ef4444]/30" },
  { value: "cancelled", label: "Cancelled", color: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30" },
]

// ─── Default draft ─────────────────────────────────────────────────────────────

function defaultDraft(reservation?: Reservation | null): CreateReservationInput & { status: string } {
  const today = new Date().toISOString().split("T")[0]
  return {
    customerName: reservation?.customerName ?? "",
    customerPhone: reservation?.customerPhone ?? "",
    customerEmail: reservation?.customerEmail ?? "",
    reservationDate: reservation?.reservationDate ?? today,
    reservationTime: reservation?.reservationTime ?? "20:00",
    partySize: reservation?.partySize ?? 2,
    tablePreference: reservation?.tablePreference ?? "",
    specialRequests: reservation?.specialRequests ?? "",
    source: reservation?.source ?? "phone",
    notes: reservation?.notes ?? "",
    status: reservation?.status ?? "confirmed",
  }
}

// ─── ReservationFormSheet ──────────────────────────────────────────────────────

export function ReservationFormSheet({
  open,
  onOpenChange,
  reservation,
  defaultTable,
  defaultTime,
  defaultSource,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation?: Reservation | null
  defaultTable?: string
  defaultTime?: string
  defaultSource?: string
}) {
  const isEdit = !!reservation
  const createRes = useCreateReservation()
  const updateRes = useUpdateReservation()

  const [draft, setDraft] = useState(() => defaultDraft(reservation))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(defaultDraft(reservation))
    setError(null)
    if (!reservation) {
      if (defaultTable)  setDraft((d) => ({ ...d, tablePreference: defaultTable }))
      if (defaultTime)   setDraft((d) => ({ ...d, reservationTime: defaultTime }))
      if (defaultSource) setDraft((d) => ({ ...d, source: defaultSource as any }))
    }
  }, [reservation?.id, open])

  const isPending = createRes.isPending || updateRes.isPending

  async function handleSubmit() {
    if (!draft.customerName.trim()) { setError("Guest name is required."); return }
    if (!draft.reservationDate)     { setError("Date is required."); return }
    if (!draft.reservationTime)     { setError("Time is required."); return }
    setError(null)
    try {
      if (isEdit && reservation) {
        await updateRes.mutateAsync({ id: reservation.id, ...draft, status: draft.status as any })
      } else {
        await createRes.mutateAsync({ ...draft })
      }
      onOpenChange(false)
    } catch (e: any) {
      // Supabase errors come as { message, details, hint, code }
      console.error("[ReservationFormSheet] save error:", e)
      const msg =
        e?.message ||
        e?.details ||
        e?.error_description ||
        "Failed to save reservation."
      setError(msg)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[480px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit Reservation" : "New Reservation"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {error && (
            <div className="rounded-md border border-red-400 bg-red-50 px-3 py-2.5 text-xs text-red-700 flex items-start gap-2">
              <span className="shrink-0 text-sm leading-none mt-px">⚠️</span>
              <div>
                <div className="font-semibold mb-0.5">Could not save reservation</div>
                <div className="opacity-80">{error}</div>
              </div>
            </div>
          )}

          {/* Guest name */}
          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Guest Name *</label>
            <input
              type="text"
              className="form-input-base"
              placeholder="Full name"
              value={draft.customerName}
              onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))}
            />
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Phone</label>
              <input
                type="tel"
                className="form-input-base"
                placeholder="+84..."
                value={draft.customerPhone}
                onChange={(e) => setDraft((d) => ({ ...d, customerPhone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Email</label>
              <input
                type="email"
                className="form-input-base"
                placeholder="email@..."
                value={draft.customerEmail}
                onChange={(e) => setDraft((d) => ({ ...d, customerEmail: e.target.value }))}
              />
            </div>
          </div>

          {/* Date + Time + Pax */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Date *</label>
              <input
                type="date"
                className="form-input-base"
                value={draft.reservationDate}
                onChange={(e) => setDraft((d) => ({ ...d, reservationDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Time *</label>
              <input
                type="time"
                className="form-input-base"
                value={draft.reservationTime}
                onChange={(e) => setDraft((d) => ({ ...d, reservationTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Pax</label>
              <input
                type="number"
                min={1}
                max={200}
                className="form-input-base"
                value={draft.partySize}
                onChange={(e) => setDraft((d) => ({ ...d, partySize: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Source</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, source: s.value }))}
                  className={cn(
                    "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                    draft.source === s.value ? s.color + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, status: s.value }))}
                    className={cn(
                      "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                      draft.status === s.value ? s.color + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Table preference */}
          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Table Preference</label>
            <input
              type="text"
              className="form-input-base"
              placeholder="e.g. VIP-1A, T33..."
              value={draft.tablePreference}
              onChange={(e) => setDraft((d) => ({ ...d, tablePreference: e.target.value }))}
            />
          </div>

          {/* Special requests */}
          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Special Requests</label>
            <textarea
              rows={2}
              className="form-input-base resize-none"
              placeholder="Birthday, anniversary, dietary..."
              value={draft.specialRequests}
              onChange={(e) => setDraft((d) => ({ ...d, specialRequests: e.target.value }))}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Internal Notes</label>
            <textarea
              rows={2}
              className="form-input-base resize-none"
              placeholder="Staff notes..."
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-sm border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-sm bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Reservation"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
