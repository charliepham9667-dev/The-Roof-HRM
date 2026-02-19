import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ExternalLink, Loader2, Pencil, Plus, RefreshCcw, Save, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

import { supabase } from "@/lib/supabase"
import {
  type EmploymentType,
  type LeaveType,
  useAddEmploymentHistory,
  useEmployeeProfile,
  useEmploymentHistory,
  useLeaveBalances,
  useUpdateEmployeeProfile,
  useUpsertLeaveBalance,
} from "@/hooks/useEmployees"
import { useStaffList } from "@/hooks/useShifts"
import { cn } from "@/lib/utils"

type TabKey =
  | "overview"
  | "details"
  | "employment-history"
  | "leave-details"
  | "management-notes"
  | "additional-information"
  | "documents-hr"
  | "documents-assets"
  | "documents-certifications"
  | "documents-medical"
  | "documents-uploaded"
  | "payments-pay"
  | "payments-banking"
  | "payments-benefits"

type SidebarItem =
  | { type: "tab"; key: TabKey; label: string; priority?: boolean }
  | { type: "heading"; label: string }

const sidebarItems: SidebarItem[] = [
  { type: "tab", key: "overview", label: "Overview", priority: true },
  { type: "tab", key: "details", label: "Employee information", priority: true },
  { type: "tab", key: "employment-history", label: "Employment history", priority: true },
  { type: "tab", key: "leave-details", label: "Leave details", priority: true },
  { type: "tab", key: "management-notes", label: "Management notes" },

  { type: "heading", label: "Documents" },
  { type: "tab", key: "documents-hr", label: "HR Documents" },
  { type: "tab", key: "documents-medical", label: "Medical Documents" },
  { type: "tab", key: "documents-certifications", label: "Certifications" },

  { type: "heading", label: "Payments" },
  { type: "tab", key: "payments-banking", label: "Banking Details" },
  { type: "tab", key: "payments-pay", label: "Pay Details" },
  { type: "tab", key: "payments-benefits", label: "Employee Benefits" },

  { type: "tab", key: "additional-information", label: "Additional information" },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function titleCaseEmploymentType(t: string | null | undefined) {
  if (!t) return ""
  return t.split("_").join(" ").replace(/\b\w/g, (m: string) => m.toUpperCase())
}

function leaveLabel(t: LeaveType) {
  switch (t) {
    case "annual":
      return "Annual"
    case "birthday":
      return "Birthday"
    case "sick":
      return "Sick"
    case "time_in_lieu":
      return "Time in lieu"
  }
}

export function EmployeeDetail() {
  const { userId } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get("tab") as TabKey | null) || "overview"

  const { data: profile, isLoading: profileLoading, error: profileError } =
    useEmployeeProfile(userId)

  const displayName = profile?.full_name || "Employee"
  const displayEmail = profile?.email || ""

  function setTab(next: TabKey) {
    const nextParams = new URLSearchParams(sp)
    nextParams.set("tab", next)
    setSp(nextParams, { replace: true })
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
          <p className="text-sm text-muted-foreground">Employee profile</p>
        </div>
        <Link to="/owner/team-directory" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Team Overview
        </Link>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="rounded-card border border-border bg-card shadow-card">
          <ScrollArea className="h-[calc(100vh-12.5rem)]">
            <div className="p-3">
              {sidebarItems.map((it) => {
                if (it.type === "heading") {
                  return (
                    <div
                      key={`heading-${it.label}`}
                      className="px-3 pb-2 pt-4 text-[12px] font-semibold uppercase text-foreground"
                    >
                      {it.label}
                    </div>
                  )
                }
                const isHeaderTab = it.key === "overview"
                return (
                  <button
                    key={it.key}
                    onClick={() => setTab(it.key)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors",
                      isHeaderTab
                        ? "text-[12px] font-semibold uppercase"
                        : "text-[12px] font-normal",
                      tab === it.key
                        ? "bg-purple-600 text-white"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {it.label}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main */}
        <div className="space-y-4">
          {/* Header card */}
          <div className="rounded-card border border-border bg-card p-5 shadow-card">
            {profileLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : profileError || !profile ? (
              <div className="py-10 text-center text-sm text-error">
                Failed to load employee profile.
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback className="text-2xl font-semibold">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold">{displayName}</h2>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                        Active
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.job_role || "—"}
                    </p>
                    {displayEmail && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {displayEmail}
                      </p>
                    )}
                    {profile.department && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {profile.department}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTab("details")}
                    className="border-purple-600/30 text-purple-700 hover:bg-purple-600/10"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit employee information
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          {tab === "overview" && <OverviewTab userId={userId} />}
          {tab === "details" && <EmploymentDetailsTab userId={userId} />}
          {tab === "employment-history" && <EmploymentHistoryTab userId={userId} />}
          {tab === "leave-details" && <LeaveDetailsTab userId={userId} />}
          {tab === "management-notes" && <ManagementNotesTab userId={userId} />}
          {tab === "additional-information" && <AdditionalInformationTab userId={userId} />}
          {tab === "documents-hr" && (
            <DocumentsTab userId={userId} title="HR Documents" category="hr" />
          )}
          {tab === "documents-medical" && (
            <DocumentsTab userId={userId} title="Medical Documents" category="medical" />
          )}
          {tab === "documents-certifications" && (
            <DocumentsTab userId={userId} title="Certifications" category="certification" />
          )}
          {tab === "payments-banking" && <PaymentsBankingTab userId={userId} />}
          {tab === "payments-pay" && <PaymentsPayTab userId={userId} />}
          {tab === "payments-benefits" && <PaymentsBenefitsTab userId={userId} />}

          {tab !== "overview" &&
            tab !== "details" &&
            tab !== "employment-history" &&
            tab !== "leave-details" &&
            tab !== "management-notes" &&
            tab !== "additional-information" &&
            tab !== "documents-hr" &&
            tab !== "documents-medical" &&
            tab !== "documents-certifications" &&
            tab !== "payments-banking" &&
            tab !== "payments-pay" &&
            tab !== "payments-benefits" && (
              <ComingSoonTab
                label={
                  sidebarItems.find((x) => x.type === "tab" && x.key === tab)?.label || "Tab"
                }
              />
            )}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ userId }: { userId?: string }) {
  const { data: profile, isLoading } = useEmployeeProfile(userId)
  const { data: staffList } = useStaffList()

  const managerName = useMemo(() => {
    if (!profile?.reports_to) return null
    const m = (staffList || []).find((p: any) => p.id === profile.reports_to)
    return m?.full_name || m?.email || profile.reports_to
  }, [profile?.reports_to, staffList])

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="text-sm text-muted-foreground">No profile found.</div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Employee information</h3>
      </div>
      <Separator className="my-4" />

      <div className="grid gap-4 md:grid-cols-2">
        <InfoRow label="Full name" value={profile.full_name || "—"} />
        <InfoRow label="Employee ID" value={profile.id || "—"} />
        <InfoRow label="Date of birth" value={"—"} />
        <InfoRow label="Address" value={"—"} />
        <InfoRow label="Phone number" value={profile.phone || "—"} />
        <InfoRow label="Email" value={profile.email || "—"} />
        <InfoRow label="Emergency contact name" value={"—"} />
        <InfoRow label="Emergency contact phone" value={"—"} />
        <InfoRow label="Date of hire" value={profile.hire_date || "—"} />
        <InfoRow label="Position" value={profile.job_role || "—"} />
        <InfoRow label="Department" value={profile.department || "—"} />
        <InfoRow label="Supervisor" value={managerName || "—"} />
        <InfoRow label="Employment type" value={titleCaseEmploymentType(profile.employment_type) || "—"} />
      </div>
    </div>
  )
}

function EmploymentDetailsTab({ userId }: { userId?: string }) {
  const { data: profile, isLoading } = useEmployeeProfile(userId)
  const { data: staffList } = useStaffList()
  const mut = useUpdateEmployeeProfile(userId || "")

  const [draft, setDraft] = useState({
    full_name: "",
    phone: "",
    hire_date: "",
    job_role: "",
    department: "",
    employment_type: "full_time" as EmploymentType,
    reports_to: "",
  })

  useEffect(() => {
    if (!profile) return
    setDraft({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      hire_date: profile.hire_date || "",
      job_role: profile.job_role || "",
      department: profile.department || "",
      employment_type: (profile.employment_type as EmploymentType) || "full_time",
      reports_to: profile.reports_to || "",
    })
  }, [profile?.id])

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="text-sm text-muted-foreground">No profile found.</div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Employee information</h3>
        <Button
          onClick={() =>
            mut.mutate({
              full_name: draft.full_name || null,
              phone: draft.phone || null,
              hire_date: draft.hire_date || null,
              job_role: draft.job_role || null,
              department: draft.department || null,
              employment_type: draft.employment_type || null,
              reports_to: draft.reports_to || null,
            })
          }
          className="bg-purple-600 hover:bg-purple-700 text-white"
          disabled={mut.isPending}
        >
          {mut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
      <Separator className="my-4" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Employee ID</Label>
          <Input value={profile.id} readOnly className="bg-muted" />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={profile.email || ""} placeholder="—" readOnly className="bg-muted" />
        </div>
        <div className="grid gap-2">
          <Label>Full name</Label>
          <Input value={draft.full_name} onChange={(e) => setDraft((s) => ({ ...s, full_name: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Phone number</Label>
          <Input value={draft.phone} onChange={(e) => setDraft((s) => ({ ...s, phone: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Date of hire</Label>
          <Input type="date" value={draft.hire_date} onChange={(e) => setDraft((s) => ({ ...s, hire_date: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Employment type</Label>
          <Select
            value={draft.employment_type}
            onValueChange={(v) => setDraft((s) => ({ ...s, employment_type: v as EmploymentType }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full time</SelectItem>
              <SelectItem value="part_time">Part time</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Position</Label>
          <Input value={draft.job_role} onChange={(e) => setDraft((s) => ({ ...s, job_role: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Department</Label>
          <Input value={draft.department} onChange={(e) => setDraft((s) => ({ ...s, department: e.target.value }))} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Supervisor</Label>
          <Select
            value={draft.reports_to || "none"}
            onValueChange={(v) => setDraft((s) => ({ ...s, reports_to: v === "none" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(staffList || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Date of birth</Label>
          <Input value="" placeholder="—" disabled />
        </div>
        <div className="grid gap-2">
          <Label>Address</Label>
          <Input value="" placeholder="—" disabled />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact name</Label>
          <Input value="" placeholder="—" disabled />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact phone</Label>
          <Input value="" placeholder="—" disabled />
        </div>
      </div>

      {mut.error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(mut.error as Error).message}
        </div>
      )}
    </div>
  )
}

function EmploymentHistoryTab({ userId }: { userId?: string }) {
  const { data: rows = [], isLoading } = useEmploymentHistory(userId)
  const addMut = useAddEmploymentHistory(userId || "")

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    job_title: "",
    industry_job_title: "",
    start_date: "",
    end_date: "",
    employment_type: "full_time" as EmploymentType,
    team: "",
  })

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Employment history</h3>
        <Button
          onClick={() => setOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <Separator className="my-4" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">Promotion / Transfer history</div>
          <div className="mt-1 text-sm text-foreground">Became general manager in July.</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">Evaluation history</div>
          <div className="mt-1 text-sm text-foreground">—</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 md:col-span-2">
          <div className="text-xs text-muted-foreground">Salary history</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>01.01.2025 - 01.03.2025 Probation bartender</li>
            <li>01.03.2025 - 01.03.2026 Junior Bartender</li>
            <li>Review contract and etc.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 md:col-span-2">
          <div className="text-xs text-muted-foreground">Disciplinary action history</div>
          <div className="mt-1 text-sm text-foreground">—</div>
        </div>
      </div>

      <Separator className="my-6" />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-foreground">Previous positions in company (if applicable)</div>
          <div className="text-muted-foreground">Finance Director</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="font-medium text-foreground">Previous positions in company (if applicable)</div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-12 bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-5">Job title</div>
              <div className="col-span-3">Employment type</div>
              <div className="col-span-2">Start date</div>
              <div className="col-span-2">End date</div>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 px-4 py-3 text-sm border-t border-border">
                <div className="col-span-5">
                  <div className="font-medium">{r.job_title}</div>
                  {r.team && <div className="text-xs text-muted-foreground">{r.team}</div>}
                </div>
                <div className="col-span-3 text-muted-foreground">{titleCaseEmploymentType(r.employment_type)}</div>
                <div className="col-span-2 text-muted-foreground">{r.start_date}</div>
                <div className="col-span-2 text-muted-foreground">{r.end_date || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Job Description</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Job title</Label>
              <Input value={form.job_title} onChange={(e) => setForm((s) => ({ ...s, job_title: e.target.value }))} placeholder="Type here to search for job titles" />
            </div>
            <div className="grid gap-2">
              <Label>Industry standard job title</Label>
              <Input value={form.industry_job_title} onChange={(e) => setForm((s) => ({ ...s, industry_job_title: e.target.value }))} placeholder="Type here to search for standard job titles" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>End date (Optional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Employment type</Label>
              <Select
                value={form.employment_type}
                onValueChange={(v) => setForm((s) => ({ ...s, employment_type: v as EmploymentType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Team</Label>
              <Input value={form.team} onChange={(e) => setForm((s) => ({ ...s, team: e.target.value }))} placeholder="Finance" />
            </div>

            {addMut.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(addMut.error as Error).message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={addMut.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={addMut.isPending || !form.job_title || !form.start_date}
                onClick={async () => {
                  await addMut.mutateAsync({
                    job_title: form.job_title,
                    industry_job_title: form.industry_job_title || null,
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                    employment_type: form.employment_type,
                    team: form.team || null,
                  })
                  setOpen(false)
                  setForm({
                    job_title: "",
                    industry_job_title: "",
                    start_date: "",
                    end_date: "",
                    employment_type: "full_time",
                    team: "",
                  })
                }}
              >
                {addMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LeaveDetailsTab({ userId }: { userId?: string }) {
  const { data: rows = [], isLoading } = useLeaveBalances(userId)
  const upsert = useUpsertLeaveBalance(userId || "")

  const allTypes: LeaveType[] = ["annual", "birthday", "sick", "time_in_lieu"]
  const byType = useMemo(() => {
    const map = new Map<LeaveType, any>()
    for (const r of rows) map.set(r.leave_type, r)
    return map
  }, [rows])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveType>("annual")
  const [form, setForm] = useState({ balance_days: "0", used_days: "0" })

  function openEdit(t: LeaveType) {
    const r = byType.get(t)
    setEditing(t)
    setForm({
      balance_days: String(r?.balance_days ?? 0),
      used_days: String(r?.used_days ?? 0),
    })
    setOpen(true)
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Leave details</h3>
      </div>
      <Separator className="my-4" />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-12 bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-4">Category</div>
            <div className="col-span-3">Balance</div>
            <div className="col-span-3">Used</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {allTypes.map((t) => {
            const r = byType.get(t)
            return (
              <div
                key={t}
                className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-border"
              >
                <div className="col-span-4 font-medium">{leaveLabel(t)}</div>
                <div className="col-span-3 text-muted-foreground">{r?.balance_days ?? 0}</div>
                <div className="col-span-3 text-muted-foreground">{r?.used_days ?? 0}</div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-600/30 text-purple-700 hover:bg-purple-600/10"
                    onClick={() => openEdit(t)}
                  >
                    Adjust
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {leaveLabel(editing)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Balance</Label>
                <Input
                  inputMode="decimal"
                  value={form.balance_days}
                  onChange={(e) => setForm((s) => ({ ...s, balance_days: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Used</Label>
                <Input
                  inputMode="decimal"
                  value={form.used_days}
                  onChange={(e) => setForm((s) => ({ ...s, used_days: e.target.value }))}
                />
              </div>
            </div>

            {upsert.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(upsert.error as Error).message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={upsert.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={upsert.isPending}
                onClick={async () => {
                  const balance = Number(form.balance_days || 0)
                  const used = Number(form.used_days || 0)
                  await upsert.mutateAsync({
                    leave_type: editing,
                    balance_days: Number.isFinite(balance) ? balance : 0,
                    used_days: Number.isFinite(used) ? used : 0,
                  })
                  setOpen(false)
                }}
              >
                {upsert.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold">{label}</h3>
      <Separator className="my-4" />
      <div className="text-sm text-muted-foreground">Coming soon.</div>
    </div>
  )
}

function DraftCallout({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 px-4 py-3 text-sm text-purple-900">
      {children}
    </div>
  )
}

function ManagementNotesTab({ userId }: { userId?: string }) {
  const [notes, setNotes] = useState<Array<{ id: string; content: string; createdAt: string }>>([
    { id: "seed-1", content: "Draft: coaching note example. Replace with real notes once DB is wired.", createdAt: "Today" },
  ])
  const [draft, setDraft] = useState("")

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Management notes</h3>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => {
            if (!draft.trim()) return
            setNotes((s) => [
              { id: String(Date.now()), content: draft.trim(), createdAt: "Just now" },
              ...s,
            ])
            setDraft("")
          }}
          disabled={!userId || !draft.trim()}
        >
          <Save className="mr-2 h-4 w-4" />
          Save note
        </Button>
      </div>
      <Separator className="my-4" />

      <DraftCallout>
        Draft UI only: management notes aren’t connected to a database table yet.
      </DraftCallout>

      <div className="mt-4 grid gap-2">
        <Label>Add a note</Label>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a private note about this employee…"
        />
      </div>

      <div className="mt-5 space-y-3">
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="text-xs text-muted-foreground">{n.createdAt}</div>
            <div className="mt-1 text-sm text-foreground">{n.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdditionalInformationTab({ userId }: { userId?: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Additional information</h3>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
      <Separator className="my-4" />

      <DraftCallout>
        Draft UI only: these fields aren’t stored yet (suggestion: add columns to `profiles` or create an `employee_additional_info` table).
      </DraftCallout>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Date of birth</Label>
          <Input type="date" disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Address</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact name</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact phone</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
      </div>
    </div>
  )
}

type DocumentCategory = "hr" | "medical" | "certification"

type DriveDoc = {
  id: string
  name: string
  mimeType: string
  createdTime: string
  modifiedTime: string
  webViewLink: string
  webContentLink: string
  size: number | null
  iconLink: string
}

function formatBytes(n: number | null) {
  if (!n || n <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // btoa expects binary string; chunk to avoid call stack issues
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function DocumentsTab({
  userId,
  title,
  category,
}: {
  userId?: string
  title: string
  category: DocumentCategory
}) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [rename, setRename] = useState("")
  const [busy, setBusy] = useState(false)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [needsConnect, setNeedsConnect] = useState(false)
  const [docs, setDocs] = useState<DriveDoc[]>([])

  const driveAuthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth`

  async function load() {
    if (!userId) return
    setLoading(true)
    setErr(null)
    try {
      const { data, error } = await supabase.functions.invoke("employee-documents-drive", {
        body: { action: "list", employeeId: userId, category },
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || "Failed to load documents")
      setDocs((data.files || []) as DriveDoc[])
      setNeedsConnect(false)
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to load documents"
      setErr(msg)
      setDocs([])
      setNeedsConnect(msg.toLowerCase().includes("not connected"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, category])

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {needsConnect && (
            <Button
              variant="outline"
              className="border-purple-600/30 text-purple-700 hover:bg-purple-600/10"
              onClick={() => window.open(driveAuthUrl, "_blank")}
            >
              Connect Google Drive
            </Button>
          )}
          <Button
            variant="outline"
            className="border-border"
            onClick={() => void load()}
            disabled={!userId || loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!userId || needsConnect}
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
      <Separator className="my-4" />

      {err && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-medium text-foreground">No documents yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {needsConnect
              ? "Connect Google Drive to list and upload employee documents."
              : "Upload a document to keep it on this profile."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-12 bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-7">File</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {docs.map((d) => (
            <div key={d.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-border">
              <div className="col-span-7 min-w-0">
                <div className="truncate font-medium text-foreground">{d.name}</div>
                <div className="truncate text-xs text-muted-foreground">{d.mimeType}</div>
              </div>
              <div className="col-span-2 text-muted-foreground">{formatBytes(d.size)}</div>
              <div className="col-span-2 text-muted-foreground">
                {d.modifiedTime ? new Date(d.modifiedTime).toLocaleDateString("en-US") : "—"}
              </div>
              <div className="col-span-1 flex justify-end gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    const url = d.webViewLink || d.webContentLink
                    if (url) window.open(url, "_blank")
                  }}
                  aria-label="Open in Google Drive"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const { data, error } = await supabase.functions.invoke("employee-documents-drive", {
                        body: { action: "delete", employeeId: userId, category, fileId: d.id },
                      })
                      if (error) throw error
                      if (!data?.success) throw new Error(data?.error || "Failed to delete")
                      await load()
                    } catch (e) {
                      setErr((e as Error)?.message || "Failed to delete")
                    } finally {
                      setBusy(false)
                    }
                  }}
                  disabled={busy}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>File</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setFile(f)
                  setRename("")
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label>Rename (optional)</Label>
              <Input value={rename} onChange={(e) => setRename(e.target.value)} placeholder={file?.name || "—"} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false)
                  setFile(null)
                  setRename("")
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!file || busy || !userId || needsConnect}
                onClick={async () => {
                  if (!file || !userId) return
                  setBusy(true)
                  setErr(null)
                  try {
                    const contentBase64 = await fileToBase64(file)
                    const fileName = (rename || file.name).trim() || file.name
                    const { data, error } = await supabase.functions.invoke("employee-documents-drive", {
                      body: {
                        action: "upload",
                        employeeId: userId,
                        category,
                        fileName,
                        mimeType: file.type || "application/octet-stream",
                        contentBase64,
                      },
                    })
                    if (error) throw error
                    if (!data?.success) throw new Error(data?.error || "Upload failed")
                    setOpen(false)
                    setFile(null)
                    setRename("")
                    await load()
                  } catch (e) {
                    const msg = (e as Error)?.message || "Upload failed"
                    setErr(msg)
                    setNeedsConnect(msg.toLowerCase().includes("not connected"))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentsBankingTab({ userId }: { userId?: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Banking Details</h3>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
      <Separator className="my-4" />

      <DraftCallout>
        Draft UI only: recommended to store banking details in a dedicated table with strict RLS (owner-only by default).
      </DraftCallout>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Bank name</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Account name</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Account number</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>BSB / SWIFT</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
      </div>
    </div>
  )
}

function PaymentsPayTab({ userId }: { userId?: string }) {
  const [payType, setPayType] = useState<"hourly" | "salary">("hourly")
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Pay Details</h3>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
      <Separator className="my-4" />

      <DraftCallout>
        Draft UI only: recommended to support effective-dated pay history (not just a single current value).
      </DraftCallout>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Pay type</Label>
          <Select value={payType} onValueChange={(v) => setPayType(v as any)} disabled={!userId}>
            <SelectTrigger>
              <SelectValue placeholder="Select pay type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{payType === "hourly" ? "Hourly rate" : "Salary (annual)"}</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Currency</Label>
          <Input disabled={!userId} placeholder="VND" />
        </div>
        <div className="grid gap-2">
          <Label>Effective date</Label>
          <Input type="date" disabled={!userId} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Notes</Label>
          <Input disabled={!userId} placeholder="—" />
        </div>
      </div>
    </div>
  )
}

function PaymentsBenefitsTab({ userId }: { userId?: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Employee Benefits</h3>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
      <Separator className="my-4" />

      <DraftCallout>
        Draft UI only: recommended to store benefits as a list (0:n) so benefits can be added/removed over time.
      </DraftCallout>

      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <div className="text-sm font-medium text-foreground">No benefits added</div>
        <div className="mt-1 text-xs text-muted-foreground">Add items like meals, transport, allowance, insurance, etc.</div>
        <div className="mt-4">
          <Button variant="outline" disabled={!userId}>
            <Plus className="mr-2 h-4 w-4" />
            Add benefit (draft)
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm text-foreground">{value}</div>
    </div>
  )
}

