import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ImageUp, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { useParseScheduleImage } from "@/hooks/useParseScheduleImage"
import {
  autoMatchEmployee,
  deriveRoleFromEmployee,
  loadNameAliases,
  normalizeName,
  saveNameAliases,
  type ParsedSchedule,
  type RoleOption,
} from "@/lib/parse-schedule"

type Employee = {
  id: string
  full_name: string | null
  job_role: string | null
  department: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Monday of the week the shifts will be written into. */
  weekStart: Date
  employees: Employee[]
  onImported: () => void
}

const ROLE_OPTIONS: { value: RoleOption; label: string }[] = [
  { value: "service", label: "Service" },
  { value: "bartender", label: "Bartender" },
  { value: "cashier", label: "Cashier" },
  { value: "kitchen", label: "Kitchen" },
  { value: "management", label: "Management" },
]

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function toYmd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type EntryRow = {
  key: string
  norm: string
  rawName: string
  dayIndex: number
  startTime: string
  endTime: string
}

export function ScheduleImportDialog({ open, onOpenChange, weekStart, employees, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const parse = useParseScheduleImage()
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null)
  const [nameToEmployee, setNameToEmployee] = useState<Record<string, string>>({})
  const [nameToRole, setNameToRole] = useState<Record<string, RoleOption>>({})
  const [deselected, setDeselected] = useState<Set<string>>(new Set())
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [importing, setImporting] = useState(false)

  const reset = useCallback(() => {
    setParsed(null)
    setNameToEmployee({})
    setNameToRole({})
    setDeselected(new Set())
    setReplaceExisting(false)
    setImporting(false)
    parse.reset()
    if (fileRef.current) fileRef.current.value = ""
  }, [parse])

  useEffect(() => {
    if (!open) reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const entries: EntryRow[] = useMemo(() => {
    if (!parsed) return []
    return parsed.entries.map((e) => {
      const norm = normalizeName(e.rawName)
      return {
        key: `${norm}|${e.dayIndex}|${e.startTime}|${e.endTime}`,
        norm,
        rawName: e.rawName,
        dayIndex: e.dayIndex,
        startTime: e.startTime,
        endTime: e.endTime,
      }
    })
  }, [parsed])

  const uniqueNames = useMemo(() => {
    const map = new Map<string, { norm: string; raw: string; count: number }>()
    for (const e of entries) {
      const cur = map.get(e.norm)
      if (cur) cur.count += 1
      else map.set(e.norm, { norm: e.norm, raw: e.rawName, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.raw.localeCompare(b.raw))
  }, [entries])

  async function handleFile(file: File) {
    try {
      const result = await parse.mutateAsync(file)
      setParsed(result)

      const aliases = loadNameAliases()
      const matchEmp: Record<string, string> = {}
      const matchRole: Record<string, RoleOption> = {}
      const seen = new Set<string>()
      for (const e of result.entries) {
        const norm = normalizeName(e.rawName)
        if (seen.has(norm)) continue
        seen.add(norm)
        const emp = autoMatchEmployee(e.rawName, employees, aliases)
        matchEmp[norm] = emp?.id ?? ""
        matchRole[norm] = deriveRoleFromEmployee(emp)
      }
      setNameToEmployee(matchEmp)
      setNameToRole(matchRole)
      setDeselected(new Set())
    } catch (e) {
      toast.error((e as Error)?.message || "Could not read the schedule image")
    }
  }

  function setEmployeeFor(norm: string, employeeId: string) {
    setNameToEmployee((prev) => ({ ...prev, [norm]: employeeId }))
    const emp = employees.find((x) => x.id === employeeId) || null
    if (emp) setNameToRole((prev) => ({ ...prev, [norm]: deriveRoleFromEmployee(emp) }))
  }

  const selectedEntries = useMemo(
    () => entries.filter((e) => !deselected.has(e.key) && nameToEmployee[e.norm]),
    [entries, deselected, nameToEmployee],
  )

  const unmatchedCount = uniqueNames.filter((n) => !nameToEmployee[n.norm]).length

  // Week sanity check: does the image's Monday day-of-month match the target week?
  const weekMismatch = useMemo(() => {
    if (!parsed?.weekStartDayOfMonth) return null
    const targetDay = weekStart.getDate()
    if (parsed.weekStartDayOfMonth === targetDay) return null
    return { imageDay: parsed.weekStartDayOfMonth, targetDay }
  }, [parsed, weekStart])

  async function doImport() {
    if (selectedEntries.length === 0) {
      toast.warning("Nothing to import — match at least one name first.")
      return
    }
    setImporting(true)
    try {
      const weekStartYmd = toYmd(weekStart)
      const weekEndYmd = toYmd(addDays(weekStart, 6))

      if (replaceExisting) {
        // Scoped delete: only DRAFT (scheduled) shifts in the target week.
        const delNew = await supabase
          .from("shifts")
          .delete()
          .eq("status", "scheduled")
          .gte("date", weekStartYmd)
          .lte("date", weekEndYmd)
        if (delNew.error) {
          const delOld = await supabase
            .from("shifts")
            .delete()
            .eq("status", "scheduled")
            .gte("shift_date", weekStartYmd)
            .lte("shift_date", weekEndYmd)
          if (delOld.error) throw delOld.error
        }
      }

      const rows = selectedEntries.map((e) => {
        const employeeId = nameToEmployee[e.norm]
        const date = toYmd(addDays(weekStart, e.dayIndex))
        const role = nameToRole[e.norm] ?? "service"
        return {
          staff_id: employeeId,
          employee_id: employeeId,
          shift_date: date,
          date,
          start_time: e.startTime,
          end_time: e.endTime,
          role,
          notes: "Imported from schedule sheet",
          status: "scheduled" as const,
        }
      })

      const firstChunk = chunk(rows, 500)[0]
      const firstIns = await supabase.from("shifts").insert(firstChunk as never)
      if (firstIns.error) {
        // Fallback for new-only schema (employee_id/date columns).
        const rowsNew = rows.map((r) => ({
          employee_id: r.employee_id,
          date: r.date,
          start_time: r.start_time,
          end_time: r.end_time,
          role: r.role,
          notes: r.notes,
          status: r.status,
        }))
        for (const c of chunk(rowsNew, 500)) {
          const ins = await supabase.from("shifts").insert(c as never)
          if (ins.error) throw ins.error
        }
      } else {
        const all = chunk(rows, 500)
        for (let i = 1; i < all.length; i++) {
          const ins = await supabase.from("shifts").insert(all[i] as never)
          if (ins.error) throw ins.error
        }
      }

      // Remember the name → employee mappings for next time.
      const aliases = loadNameAliases()
      for (const n of uniqueNames) {
        const id = nameToEmployee[n.norm]
        if (id) aliases[n.norm] = id
      }
      saveNameAliases(aliases)

      toast.success(
        `Imported ${rows.length} shift${rows.length === 1 ? "" : "s"} as draft. Review, then Publish.`,
      )
      onImported()
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to import shifts")
    } finally {
      setImporting(false)
    }
  }

  const showReview = !!parsed && !parse.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import schedule from screenshot</DialogTitle>
        </DialogHeader>

        {!showReview ? (
          <div className="space-y-4 py-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parse.isPending}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-10 text-center transition hover:bg-muted/40 disabled:opacity-60"
            >
              {parse.isPending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Reading the schedule…</span>
                </>
              ) : (
                <>
                  <ImageUp className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload a schedule screenshot</span>
                  <span className="text-xs text-muted-foreground">
                    PNG or JPG of your weekly roster sheet
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Shifts import as <strong>draft</strong> into the week of{" "}
              <strong>{toYmd(weekStart)}</strong>. You review and hit Publish to notify staff.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {weekMismatch && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The image looks like the week starting day <strong>{weekMismatch.imageDay}</strong>,
                  but you’re importing into the week starting day <strong>{weekMismatch.targetDay}</strong>.
                  Close this and switch weeks first if that’s wrong.
                </span>
              </div>
            )}

            {parsed?.warnings?.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}

            {/* Name matching */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Match names ({uniqueNames.length})</h4>
                {unmatchedCount > 0 && (
                  <span className="text-xs font-medium text-amber-600">
                    {unmatchedCount} unmatched — pick a person
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {uniqueNames.map((n) => {
                  const matched = !!nameToEmployee[n.norm]
                  return (
                    <div
                      key={n.norm}
                      className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-2 rounded-md border border-border/60 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{n.raw}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {n.count} shift{n.count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <Select
                        value={nameToEmployee[n.norm] || "none"}
                        onValueChange={(v) => setEmployeeFor(n.norm, v === "none" ? "" : v)}
                      >
                        <SelectTrigger
                          className={`h-8 text-xs ${matched ? "" : "border-amber-400 text-amber-700"}`}
                        >
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— skip this person —</SelectItem>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.full_name || "Unknown"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={nameToRole[n.norm] || "service"}
                        onValueChange={(v) =>
                          setNameToRole((prev) => ({ ...prev, [n.norm]: v as RoleOption }))
                        }
                        disabled={!matched}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Shift list */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Shifts to import ({selectedEntries.length}/{entries.length})
              </h4>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1.5">
                {entries.map((e) => {
                  const matched = !!nameToEmployee[e.norm]
                  const on = !deselected.has(e.key) && matched
                  const d = addDays(weekStart, e.dayIndex)
                  return (
                    <label
                      key={e.key}
                      className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${
                        matched ? "hover:bg-muted/40" : "opacity-50"
                      }`}
                    >
                      <Checkbox
                        checked={on}
                        disabled={!matched}
                        onCheckedChange={(c) =>
                          setDeselected((prev) => {
                            const next = new Set(prev)
                            if (c) next.delete(e.key)
                            else next.add(e.key)
                            return next
                          })
                        }
                      />
                      <span className="w-16 font-medium">{e.rawName}</span>
                      <span className="w-20 text-muted-foreground">
                        {DAY_LABELS[e.dayIndex]} {d.getDate()}
                      </span>
                      <span className="tabular-nums">
                        {e.startTime}–{e.endTime}
                      </span>
                      {!matched && <span className="text-amber-600">needs a person</span>}
                    </label>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={replaceExisting}
                onCheckedChange={(c) => setReplaceExisting(!!c)}
              />
              Replace existing draft shifts for this week first (won’t touch published shifts)
            </label>
          </div>
        )}

        {showReview && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={reset} disabled={importing}>
              Upload another
            </Button>
            <Button onClick={doImport} disabled={importing || selectedEntries.length === 0}>
              {importing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${selectedEntries.length} shift${selectedEntries.length === 1 ? "" : "s"} as draft`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
