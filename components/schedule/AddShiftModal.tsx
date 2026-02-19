/* eslint-disable @next/next/no-img-element */
"use client"

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return createClient(url, anon)
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function parseTimeToMinutes(t: string) {
  const [hhStr, mmStr] = t.split(":")
  const hh = Number(hhStr) || 0
  const mm = Number(mmStr) || 0
  return hh * 60 + mm
}

function normalizeTime(t: string) {
  // input can be HH:mm or HH:mm:ss; return HH:mm
  const parts = t.split(":")
  return `${String(parts[0] || "00").padStart(2, "0")}:${String(parts[1] || "00").padStart(2, "0")}`
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} minutes`
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`
  return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = parseTimeToMinutes(normalizeTime(aStart))
  const ae = parseTimeToMinutes(normalizeTime(aEnd))
  const bs = parseTimeToMinutes(normalizeTime(bStart))
  const be = parseTimeToMinutes(normalizeTime(bEnd))
  return as < be && ae > bs
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
}) {
  const supabase = useMemo(() => supabaseProp ?? getSupabaseClient(), [supabaseProp])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(() => ({
    employee_id: "open",
    date: toYmd(new Date()),
    start_time: "10:00",
    end_time: "19:00",
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
      end_time: normalizeTime((editShift ? editShift.end_time : prefill?.end_time) ?? d.end_time),
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
  }, [draft, existingShifts, invalidTime])

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
        end_time: draft.end_time,
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
        // Prefer new columns (employee_id/date). This supports open shifts.
        const insertNew = await supabase
          .from("shifts")
          .insert({
            employee_id: employeeId,
            date: draft.date,
            start_time: draft.start_time,
            end_time: draft.end_time,
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
              end_time: draft.end_time,
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
            <div className="grid gap-2">
              <Label>Start time</Label>
              <Input
                type="time"
                step={900}
                value={draft.start_time}
                onChange={(e) => setDraft((s) => ({ ...s, start_time: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>End time</Label>
              <Input
                type="time"
                step={900}
                value={draft.end_time}
                onChange={(e) => setDraft((s) => ({ ...s, end_time: e.target.value }))}
              />
            </div>
          </div>

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
            <Label>Notes (optional)</Label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Add notes…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSave}
              disabled={saving || invalidTime || !draft.date}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                editShift?.id ? "Save changes" : "Save shift"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

