import { useEffect, useMemo, useState } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"

type Employee = {
  id: string
  full_name: string | null
  email: string | null
}

type ShiftLike = {
  id: string
  employee_id: string | null
  date: string // YYYY-MM-DD
  start_time: string // HH:mm or HH:mm:ss
  end_time: string // HH:mm or HH:mm:ss
  status?: string | null
}

type RoleOption = "service" | "bartender" | "cashier" | "kitchen" | "management"

const ROLE_OPTIONS: RoleOption[] = ["service", "bartender", "cashier", "kitchen", "management"]
function isRoleOption(v: unknown): v is RoleOption {
  return typeof v === "string" && (ROLE_OPTIONS as string[]).includes(v)
}

type Draft = {
  employee_id: string | "open"
  date: string
  start_time: string
  end_time: string
  role: RoleOption
  notes: string
}

function getSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anon) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY")
  }
  return createClient(url, anon)
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// ── Time helpers ──────────────────────────────────────────────────────────────
// UI uses "25:30" to mean 01:30 next day. DB only accepts 00:00–23:59.
// toDbTime:  "25:30" → "01:30"  (strip the overflow before saving)
// toUiTime:  if end_time < start_time when loaded from DB, convert to 25:xx
// ─────────────────────────────────────────────────────────────────────────────

function parseTimeToMinutes(t: string) {
  const [hhStr, mmStr] = t.split(":")
  return (Number(hhStr) || 0) * 60 + (Number(mmStr) || 0)
}

function normalizeTime(t: string) {
  const parts = t.split(":")
  return `${String(parts[0] || "00").padStart(2, "0")}:${String(parts[1] || "00").padStart(2, "0")}`
}

/** Convert a UI time value to a DB-safe HH:mm (wraps 25:30 → 01:30) */
function toDbTime(t: string): string {
  const mins = parseTimeToMinutes(normalizeTime(t))
  const wrapped = mins >= 24 * 60 ? mins - 24 * 60 : mins
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0")
  const m = String(wrapped % 60).padStart(2, "0")
  return `${h}:${m}`
}

/** When loading from DB, if end < start treat end as next-day and convert to 25:xx */
function toUiTime(endTime: string, startTime: string): string {
  const s = parseTimeToMinutes(normalizeTime(startTime))
  const e = parseTimeToMinutes(normalizeTime(endTime))
  if (e < s) {
    // end is next day — represent as 25:xx etc.
    const overflow = e + 24 * 60
    const h = String(Math.floor(overflow / 60)).padStart(2, "0")
    const mm = String(overflow % 60).padStart(2, "0")
    return `${h}:${mm}`
  }
  return normalizeTime(endTime)
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} minutes`
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`
  return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`
}

/** Display label: 25:30 → "01:30 (+1)" */
function formatTimeLabel(t: string) {
  const mins = parseTimeToMinutes(t)
  if (mins < 24 * 60) return t
  const overflow = mins - 24 * 60
  const h = String(Math.floor(overflow / 60)).padStart(2, "0")
  const m = String(overflow % 60).padStart(2, "0")
  return `${h}:${m} (+1)`
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = parseTimeToMinutes(normalizeTime(aStart))
  let ae = parseTimeToMinutes(normalizeTime(aEnd))
  const bs = parseTimeToMinutes(normalizeTime(bStart))
  let be = parseTimeToMinutes(normalizeTime(bEnd))
  if (ae < as) ae += 24 * 60
  if (be < bs) be += 24 * 60
  return as < be && ae > bs
}

// Time options 10:00 → 27:00 in 30-min steps (27:00 = 03:00 next day)
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let mins = 10 * 60; mins <= 27 * 60; mins += 30) {
    const h = String(Math.floor(mins / 60)).padStart(2, "0")
    const m = String(mins % 60).padStart(2, "0")
    opts.push(`${h}:${m}`)
  }
  return opts
})()

function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  // Allow both selecting from the list and typing a custom value
  const [custom, setCustom] = useState(false)
  const inList = TIME_OPTIONS.includes(value)

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {custom || !inList ? (
        <div className="flex gap-1.5">
          <Input
            type="text"
            placeholder="e.g. 25:30"
            value={value}
            onChange={(e) => {
              const v = e.target.value.trim()
              // Accept partial input while typing
              onChange(v)
            }}
            onBlur={(e) => {
              // Normalize on blur
              const raw = e.target.value.trim()
              if (/^\d{1,2}:\d{2}$/.test(raw)) onChange(normalizeTime(raw))
            }}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setCustom(false)} className="px-2 text-xs">
            ▾
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue>{formatTimeLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIME_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatTimeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => setCustom(true)} className="px-2 text-xs" title="Type custom time">
            ✎
          </Button>
        </div>
      )}
    </div>
  )
}

export function AddShiftModal({
  open,
  onOpenChange,
  employees,
  existingShifts,
  prefill,
  editShift,
  shiftSchema = "new",
  supabase: supabaseProp,
  onSuccess,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  existingShifts: ShiftLike[]
  prefill?: Partial<Pick<Draft, "employee_id" | "date" | "start_time" | "end_time" | "role">>
  editShift?: (ShiftLike & { role?: string | null; notes?: string | null }) | null
  shiftSchema?: "new" | "old"
  supabase?: SupabaseClient
  onSuccess?: () => void
  onDelete?: (id: string) => Promise<void>
}) {
  const supabase = useMemo(() => supabaseProp ?? getSupabaseClient(), [supabaseProp])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(() => ({
    employee_id: "open",
    date: toYmd(new Date()),
    start_time: "14:00",
    end_time: "23:00",
    role: "service",
    notes: "",
  }))

  useEffect(() => {
    if (!open) return
    setError(null)
    setDraft((d) => ({
      ...d,
      employee_id:
        (editShift
          ? (editShift.employee_id ?? "open")
          : prefill?.employee_id) ?? d.employee_id,
      date: (editShift ? editShift.date : prefill?.date) ?? d.date,
      start_time: normalizeTime((editShift ? editShift.start_time : prefill?.start_time) ?? d.start_time),
      end_time: (() => {
        const rawEnd = (editShift ? editShift.end_time : prefill?.end_time) ?? d.end_time
        const rawStart = (editShift ? editShift.start_time : prefill?.start_time) ?? d.start_time
        return toUiTime(rawEnd, rawStart)
      })(),
      role: (() => {
        const next = editShift ? editShift.role : prefill?.role
        return isRoleOption(next) ? next : d.role
      })(),
      notes: editShift ? (editShift.notes ?? "") : "",
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startM = parseTimeToMinutes(draft.start_time)
  const endM = parseTimeToMinutes(draft.end_time)
  // End must be after start; post-midnight times like 25:30 are always valid
  const durationMins = Math.max(0, endM - startM)
  const invalidTime = endM <= startM

  const overlapWarning = useMemo(() => {
    if (draft.employee_id === "open") return null
    if (!draft.date) return null
    if (invalidTime) return null

    const relevant = existingShifts.filter(
      (s) =>
        (!editShift || s.id !== editShift.id) &&
        s.employee_id === draft.employee_id &&
        s.date === draft.date &&
        String(s.status || "").toLowerCase() !== "cancelled",
    )
    for (const s of relevant) {
      if (overlaps(draft.start_time, draft.end_time, s.start_time, s.end_time)) {
        return s
      }
    }
    return null
  }, [draft, existingShifts, invalidTime, editShift])

  async function handleSave() {
    setError(null)
    if (invalidTime) {
      setError("Start time must be before end time.")
      return
    }
    if (!draft.date) {
      setError("Please select a date.")
      return
    }

    setSaving(true)
    try {
      const employeeId = draft.employee_id === "open" ? null : draft.employee_id

      const payloadCommon = {
        start_time: draft.start_time,
        end_time: toDbTime(draft.end_time), // convert 25:30 → 01:30 for DB
        role: draft.role,
        notes: draft.notes || null,
        updated_at: new Date().toISOString(),
      }

      if (editShift?.id) {
        // UPDATE
        if (shiftSchema === "old" && employeeId === null) {
          throw new Error("Unassigning shifts requires the new shifts schema (employee_id/date).")
        }

        if (shiftSchema === "new") {
          const upd = await supabase
            .from("shifts")
            .update({
              ...payloadCommon,
              employee_id: employeeId,
              date: draft.date,
            } as any)
            .eq("id", editShift.id)
            .select("id")
            .single()
          if (upd.error) throw upd.error
        } else {
          const upd = await supabase
            .from("shifts")
            .update({
              ...payloadCommon,
              staff_id: employeeId,
              shift_date: draft.date,
            } as any)
            .eq("id", editShift.id)
            .select("id")
            .single()
          if (upd.error) throw upd.error
        }

        toast.success("Shift updated successfully")
      } else {
        // INSERT
        const insertNew = await supabase
          .from("shifts")
          .insert({
            employee_id: employeeId,
            date: draft.date,
            start_time: draft.start_time,
            end_time: toDbTime(draft.end_time),
            role: draft.role,
            notes: draft.notes || null,
            status: "scheduled",
          })
          .select("id")
          .single()

        if (insertNew.error) {
          // Fallback to old schema only if assigned (old schema requires staff_id NOT NULL)
          if (!employeeId) {
            throw new Error(
              insertNew.error.message ||
                "Open shifts require the new shifts schema (employee_id/date).",
            )
          }

          const insertOld = await supabase
            .from("shifts")
            .insert({
              staff_id: employeeId,
              shift_date: draft.date,
              start_time: draft.start_time,
              end_time: toDbTime(draft.end_time),
              role: draft.role,
              notes: draft.notes || null,
              status: "scheduled",
            } as any)
            .select("id")
            .single()

          if (insertOld.error) throw insertOld.error
        }

        toast.success("Shift added successfully")
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      setError((e as Error)?.message || "Failed to save shift")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editShift?.id ? "Edit shift" : "Add shift"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label>Employee</Label>
            <Select
              value={draft.employee_id}
              onValueChange={(v) => setDraft((s) => ({ ...s, employee_id: v as any }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Leave unassigned (open shift)</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name || e.email || e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((s) => ({ ...s, date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TimeSelect
              label="Start time"
              value={draft.start_time}
              onChange={(v) => setDraft((s) => ({ ...s, start_time: v }))}
            />
            <TimeSelect
              label="End time"
              value={draft.end_time}
              onChange={(v) => setDraft((s) => ({ ...s, end_time: v }))}
            />
          </div>
          {endM > 24 * 60 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
              End time is past midnight — shift ends on the next calendar day.
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Duration:{" "}
            <span className={invalidTime ? "text-destructive" : "text-foreground"}>
              {invalidTime ? "—" : formatDuration(durationMins)}
            </span>
          </div>

          {overlapWarning && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
              This shift overlaps with an existing shift for this employee.
            </div>
          )}

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => setDraft((s) => ({ ...s, role: v as RoleOption }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="bartender">Bartender</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="management">Management</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Input
              value={draft.notes}
              onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Optional notes…"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {editShift?.id && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving || deleting}
                  onClick={async () => {
                    if (!editShift.id) return
                    setDeleting(true)
                    try {
                      await onDelete(editShift.id)
                      onOpenChange(false)
                    } catch (e) {
                      setError((e as Error)?.message || "Failed to delete shift")
                    } finally {
                      setDeleting(false)
                    }
                  }}
                >
                  {deleting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
                  ) : (
                    "Delete shift"
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleSave}
                disabled={saving || deleting || invalidTime || !draft.date}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editShift?.id ? (
                  "Save changes"
                ) : (
                  "Save shift"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

