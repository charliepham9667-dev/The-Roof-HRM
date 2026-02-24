import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { Copy, ExternalLink, Loader2, Pencil, Plus, RefreshCcw, Save, Trash2 } from "lucide-react"

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

import {
  type EmploymentType,
  type LeaveType,
  useAddEmploymentHistory,
  useDeleteEmploymentHistory,
  useEmployeeProfile,
  useEmploymentHistory,
  useLeaveBalances,
  useUpdateEmployeeProfile,
  useUpdateEmploymentHistory,
  useUpsertLeaveBalance,
} from "@/hooks/useEmployees"
import {
  useAddManagementNote,
  useDeleteManagementNote,
  useEmployeeManagementNotes,
} from "@/hooks/useManagementNotes"
import {
  getDocumentDownloadUrl,
  type DocumentCategory,
  useDeleteEmployeeDocument,
  useEmployeeDocuments,
  useUploadEmployeeDocument,
} from "@/hooks/useEmployeeDocuments"
import {
  useAddEmployeeBenefit,
  useDeleteEmployeeBenefit,
  useEmployeeBenefits,
  useEmployeeBanking,
  useEmployeePayDetails,
  useAddEmployeePayDetail,
  useUpdateEmployeePayDetail,
  useDeleteEmployeePayDetail,
  useUpsertEmployeeBanking,
} from "@/hooks/useEmployeePayments"
import { useStaffList } from "@/hooks/useShifts"
import { cn } from "@/lib/utils"

type TabKey =
  | "overview"
  | "details"
  | "employment-history"
  | "leave-details"
  | "management-notes"
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
        <InfoRow label="Date of birth" value={profile.date_of_birth ? new Date(profile.date_of_birth + "T12:00:00").toLocaleDateString("en-GB") : "—"} />
        <InfoRow label="Address" value={profile.address || "—"} />
        <InfoRow label="Phone number" value={profile.phone || "—"} />
        <InfoRow label="Email" value={profile.email || "—"} />
        <InfoRow label="Emergency contact name" value={profile.emergency_contact_name || "—"} />
        <InfoRow label="Emergency contact phone" value={profile.emergency_contact_phone || "—"} />
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
    date_of_birth: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
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
      date_of_birth: profile.date_of_birth ? profile.date_of_birth.split("T")[0] : "",
      address: profile.address || "",
      emergency_contact_name: profile.emergency_contact_name || "",
      emergency_contact_phone: profile.emergency_contact_phone || "",
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
              date_of_birth: draft.date_of_birth || null,
              address: draft.address || null,
              emergency_contact_name: draft.emergency_contact_name || null,
              emergency_contact_phone: draft.emergency_contact_phone || null,
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
          <Input type="date" value={draft.date_of_birth} onChange={(e) => setDraft((s) => ({ ...s, date_of_birth: e.target.value }))} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Address</Label>
          <Input value={draft.address} onChange={(e) => setDraft((s) => ({ ...s, address: e.target.value }))} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact name</Label>
          <Input value={draft.emergency_contact_name} onChange={(e) => setDraft((s) => ({ ...s, emergency_contact_name: e.target.value }))} placeholder="—" />
        </div>
        <div className="grid gap-2">
          <Label>Emergency contact phone</Label>
          <Input value={draft.emergency_contact_phone} onChange={(e) => setDraft((s) => ({ ...s, emergency_contact_phone: e.target.value }))} placeholder="—" />
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
  const updateMut = useUpdateEmploymentHistory(userId || "")
  const deleteMut = useDeleteEmploymentHistory(userId || "")

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
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

      <Separator className="my-4" />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-foreground">Previous positions in company</div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-muted-foreground">
            No employment history yet. Click <strong>Add</strong> to record a position.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="font-medium text-foreground">Previous positions in company (if applicable)</div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-12 bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-5">Job title</div>
              <div className="col-span-2">Employment type</div>
              <div className="col-span-2">Start date</div>
              <div className="col-span-2">End date</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-border gap-2">
                <div className="col-span-5">
                  <div className="font-medium">{r.job_title}</div>
                  {r.team && <div className="text-xs text-muted-foreground">{r.team}</div>}
                </div>
                <div className="col-span-2 text-muted-foreground">{titleCaseEmploymentType(r.employment_type)}</div>
                <div className="col-span-2 text-muted-foreground">{r.start_date}</div>
                <div className="col-span-2 text-muted-foreground">{r.end_date || "—"}</div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditId(r.id)
                      setForm({
                        job_title: r.job_title,
                        industry_job_title: r.industry_job_title || "",
                        start_date: r.start_date,
                        end_date: r.end_date || "",
                        employment_type: r.employment_type,
                        team: r.team || "",
                      })
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMut.mutate(r.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
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

            {updateMut.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(updateMut.error as Error).message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditId(null)}
                disabled={updateMut.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={updateMut.isPending || !form.job_title || !form.start_date || !editId}
                onClick={async () => {
                  if (!editId) return
                  await updateMut.mutateAsync({
                    id: editId,
                    job_title: form.job_title,
                    industry_job_title: form.industry_job_title || null,
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                    employment_type: form.employment_type,
                    team: form.team || null,
                  })
                  setEditId(null)
                }}
              >
                {updateMut.isPending ? (
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

function ManagementNotesTab({ userId }: { userId?: string }) {
  const { data: notes = [], isLoading } = useEmployeeManagementNotes(userId)
  const addMut = useAddManagementNote(userId || "")
  const deleteMut = useDeleteManagementNote(userId || "")
  const [draft, setDraft] = useState("")

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Management notes</h3>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={async () => {
            if (!draft.trim() || !userId) return
            try {
              await addMut.mutateAsync(draft.trim())
              setDraft("")
            } catch {}
          }}
          disabled={!userId || !draft.trim() || addMut.isPending}
        >
          {addMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save note
            </>
          )}
        </Button>
      </div>
      <Separator className="my-4" />

      <div className="grid gap-2">
        <Label>Add a note</Label>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a private note about this employee…"
        />
      </div>

      {addMut.error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(addMut.error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {n.author?.full_name && ` · ${n.author.full_name}`}
                </div>
                <div className="mt-1 text-sm text-foreground">{n.content}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMut.mutate(n.id)}
                disabled={deleteMut.isPending}
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No notes yet. Add a note above to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
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

  const { data: docs = [], isLoading: loading, error: loadError, refetch } = useEmployeeDocuments(userId, category)
  const uploadMut = useUploadEmployeeDocument(userId || "")
  const deleteMut = useDeleteEmployeeDocument(userId || "")

  async function handleOpenDoc(d: { file_path: string }) {
    try {
      const { data } = await getDocumentDownloadUrl(d.file_path)
      if (data?.signedUrl) window.open(data.signedUrl, "_blank")
    } catch {}
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => refetch()}
            disabled={!userId || loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!userId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
      <Separator className="my-4" />

      {loadError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(loadError as Error).message}
        </div>
      )}

      {uploadMut.error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(uploadMut.error as Error).message}
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
            Upload a document to keep it on this profile.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-12 bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-7">File</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Uploaded</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {docs.map((d) => (
            <div key={d.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-border">
              <div className="col-span-7 min-w-0">
                <div className="truncate font-medium text-foreground">{d.file_name}</div>
                <div className="truncate text-xs text-muted-foreground">{d.mime_type || "—"}</div>
              </div>
              <div className="col-span-2 text-muted-foreground">{formatBytes(d.size_bytes)}</div>
              <div className="col-span-2 text-muted-foreground">
                {d.created_at ? new Date(d.created_at).toLocaleDateString("en-US") : "—"}
              </div>
              <div className="col-span-1 flex justify-end gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleOpenDoc(d)}
                  aria-label="Open document"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteMut.mutate({ id: d.id, file_path: d.file_path, category })}
                  disabled={deleteMut.isPending}
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
                disabled={uploadMut.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!file || !userId || uploadMut.isPending}
                onClick={async () => {
                  if (!file || !userId) return
                  try {
                    await uploadMut.mutateAsync({
                      category,
                      file,
                      fileName: (rename || file.name).trim() || file.name,
                    })
                    setOpen(false)
                    setFile(null)
                    setRename("")
                  } catch {}
                }}
              >
                {uploadMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentsBankingTab({ userId }: { userId?: string }) {
  const { data: banking, isLoading } = useEmployeeBanking(userId)
  const upsertMut = useUpsertEmployeeBanking(userId || "")

  const [bankName, setBankName] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [bsbSwift, setBsbSwift] = useState("")

  useEffect(() => {
    if (banking) {
      setBankName(banking.bank_name ?? "")
      setAccountName(banking.account_name ?? "")
      setAccountNumber(banking.account_number ?? "")
      setBsbSwift(banking.bsb_swift ?? "")
    }
  }, [banking])

  async function handleSave() {
    if (!userId) return
    upsertMut.mutate(
      { bank_name: bankName, account_name: accountName, account_number: accountNumber, bsb_swift: bsbSwift },
      { onError: () => {} }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-border bg-card p-12 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Banking Details</h3>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white"
          disabled={!userId || upsertMut.isPending}
          onClick={handleSave}
        >
          {upsertMut.isPending ? (
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Bank name</Label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            disabled={!userId}
            placeholder="—"
          />
        </div>
        <div className="grid gap-2">
          <Label>Account name</Label>
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            disabled={!userId}
            placeholder="—"
          />
        </div>
        <div className="grid gap-2">
          <Label>Account number</Label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            disabled={!userId}
            placeholder="—"
          />
        </div>
        <div className="grid gap-2">
          <Label>BSB / SWIFT</Label>
          <Input
            value={bsbSwift}
            onChange={(e) => setBsbSwift(e.target.value)}
            disabled={!userId}
            placeholder="—"
          />
        </div>
      </div>
    </div>
  )
}

function PaymentsPayTab({ userId }: { userId?: string }) {
  const { data: payHistory = [], isLoading } = useEmployeePayDetails(userId)
  const addMut = useAddEmployeePayDetail(userId || "")
  const updateMut = useUpdateEmployeePayDetail(userId || "")
  const deleteMut = useDeleteEmployeePayDetail(userId || "")

  const [payType, setPayType] = useState<"hourly" | "salary">("hourly")
  const [rateValue, setRateValue] = useState("")
  const [currency, setCurrency] = useState("VND")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [notes, setNotes] = useState("")

  const [editId, setEditId] = useState<string | null>(null)
  const [editPayType, setEditPayType] = useState<"hourly" | "salary">("hourly")
  const [editRateValue, setEditRateValue] = useState("")
  const [editCurrency, setEditCurrency] = useState("VND")
  const [editEffectiveDate, setEditEffectiveDate] = useState("")
  const [editNotes, setEditNotes] = useState("")

  function openEdit(p: { id: string; pay_type: string; rate_value: number; currency: string; effective_date: string; notes: string | null }) {
    setEditId(p.id)
    setEditPayType((p.pay_type || "hourly") as "hourly" | "salary")
    setEditRateValue(String(p.rate_value ?? ""))
    setEditCurrency(p.currency || "VND")
    setEditEffectiveDate(p.effective_date ? p.effective_date.slice(0, 10) : "")
    setEditNotes(p.notes || "")
  }

  async function handleAdd() {
    if (!userId) return
    const rate = parseFloat(rateValue)
    if (isNaN(rate) || rate < 0 || !effectiveDate) return
    addMut.mutate(
      { pay_type: payType, rate_value: rate, currency, effective_date: effectiveDate, notes: notes || undefined },
      {
        onSuccess: () => {
          setRateValue("")
          setEffectiveDate("")
          setNotes("")
        },
      }
    )
  }

  async function handleUpdate() {
    if (!editId || !userId) return
    const rate = parseFloat(editRateValue)
    if (isNaN(rate) || rate < 0 || !editEffectiveDate) return
    await updateMut.mutateAsync({
      id: editId,
      pay_type: editPayType,
      rate_value: rate,
      currency: editCurrency,
      effective_date: editEffectiveDate,
      notes: editNotes.trim() || null,
    })
    setEditId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-border bg-card p-12 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Pay Details</h3>
      </div>
      <Separator className="my-4" />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Pay type</Label>
          <Select value={payType} onValueChange={(v) => setPayType(v as "hourly" | "salary")} disabled={!userId}>
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
          <Label>{payType === "hourly" ? "Hourly rate" : "Salary (monthly)"}</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            disabled={!userId}
            placeholder="—"
          />
        </div>
        <div className="grid gap-2">
          <Label>Currency</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!userId} placeholder="VND" />
        </div>
        <div className="grid gap-2">
          <Label>Effective date</Label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            disabled={!userId}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!userId} placeholder="—" />
        </div>
        <div className="md:col-span-2">
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!userId || addMut.isPending || !rateValue.trim() || !effectiveDate}
            onClick={handleAdd}
          >
            {addMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save pay rate
              </>
            )}
          </Button>
        </div>
      </div>

      {payHistory.length > 0 && (
        <>
          <h4 className="text-sm font-medium text-muted-foreground">Pay history</h4>
          <div className="mt-2 space-y-2">
            {payHistory.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {p.pay_type === "hourly" ? "Hourly" : "Salary"}: {p.rate_value.toLocaleString()} {p.currency}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Effective {new Date(p.effective_date).toLocaleDateString()}
                  </span>
                  {p.notes && <div className="mt-1 text-sm text-muted-foreground">{p.notes}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={!userId || updateMut.isPending}
                    onClick={() => openEdit(p)}
                    aria-label="Edit pay rate"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={!userId || deleteMut.isPending}
                    onClick={() => deleteMut.mutate(p.id)}
                    aria-label="Delete pay rate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit pay rate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Pay type</Label>
              <Select value={editPayType} onValueChange={(v) => setEditPayType(v as "hourly" | "salary")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{editPayType === "hourly" ? "Hourly rate" : "Salary (monthly)"}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={editRateValue}
                onChange={(e) => setEditRateValue(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Input value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} placeholder="VND" />
            </div>
            <div className="grid gap-2">
              <Label>Effective date</Label>
              <Input
                type="date"
                value={editEffectiveDate}
                onChange={(e) => setEditEffectiveDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!editRateValue.trim() || !editEffectiveDate || updateMut.isPending}
              onClick={handleUpdate}
            >
              {updateMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentsBenefitsTab({ userId }: { userId?: string }) {
  const { data: staffList = [] } = useStaffList()
  const { data: benefits = [], isLoading } = useEmployeeBenefits(userId)
  const addMut = useAddEmployeeBenefit(userId || "")
  const deleteMut = useDeleteEmployeeBenefit(userId || "")

  const [benefitType, setBenefitType] = useState("")
  const [benefitAmount, setBenefitAmount] = useState("")
  const [benefitNotes, setBenefitNotes] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [copyFromOpen, setCopyFromOpen] = useState(false)
  const [copyFromId, setCopyFromId] = useState<string>("")

  const { data: sourceBenefits = [] } = useEmployeeBenefits(copyFromId || undefined)
  const sourceStaff = staffList.filter((s: { id: string }) => s.id !== userId)

  async function handleAdd() {
    if (!userId) return
    const trimmed = benefitType.trim()
    if (!trimmed) return
    const amount = benefitAmount.trim() ? parseFloat(benefitAmount) : null
    addMut.mutate(
      { benefit_type: trimmed, amount: amount ?? null, notes: benefitNotes.trim() || null },
      {
        onSuccess: () => {
          setBenefitType("")
          setBenefitAmount("")
          setBenefitNotes("")
          setAddOpen(false)
        },
      }
    )
  }

  async function handleCopyFromEmployee() {
    if (!userId || !copyFromId || sourceBenefits.length === 0) return
    for (const b of sourceBenefits) {
      await addMut.mutateAsync({
        benefit_type: b.benefit_type,
        amount: b.amount,
        notes: b.notes,
      })
    }
    setCopyFromOpen(false)
    setCopyFromId("")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-border bg-card p-12 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Employee Benefits</h3>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!userId || sourceStaff.length === 0} onClick={() => setCopyFromOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy from employee
          </Button>
          <Button variant="outline" disabled={!userId} onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add benefit
          </Button>
        </div>
      </div>
      <Separator className="my-4" />

      {benefits.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-medium text-foreground">No benefits added</div>
          <div className="mt-1 text-xs text-muted-foreground">Add items like meals, transport, allowance, insurance, etc.</div>
          <div className="mt-4">
            <Button variant="outline" disabled={!userId} onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add benefit
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {benefits.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <div className="font-medium">{b.benefit_type}</div>
                {b.amount != null && (
                  <div className="text-sm text-muted-foreground">{b.amount.toLocaleString()}</div>
                )}
                {b.notes && <div className="text-sm text-muted-foreground">{b.notes}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={!userId || deleteMut.isPending}
                  onClick={() => deleteMut.mutate(b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add benefit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Benefit type</Label>
              <Input
                value={benefitType}
                onChange={(e) => setBenefitType(e.target.value)}
                placeholder="e.g. Meals, Transport, Insurance"
              />
            </div>
            <div className="grid gap-2">
              <Label>Amount (optional)</Label>
              <Input
                type="number"
                min={0}
                value={benefitAmount}
                onChange={(e) => setBenefitAmount(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Input value={benefitNotes} onChange={(e) => setBenefitNotes(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!benefitType.trim() || addMut.isPending}
              onClick={handleAdd}
            >
              {addMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={copyFromOpen} onOpenChange={(o) => { setCopyFromOpen(o); if (!o) setCopyFromId("") }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy benefits from employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Select employee to copy from</Label>
              <Select value={copyFromId} onValueChange={setCopyFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee…" />
                </SelectTrigger>
                <SelectContent>
                  {sourceStaff.map((s: { id: string; full_name?: string; email?: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {copyFromId && (
              <p className="text-sm text-muted-foreground">
                {sourceBenefits.length} benefit{sourceBenefits.length !== 1 ? "s" : ""} to copy
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCopyFromOpen(false); setCopyFromId("") }}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!copyFromId || sourceBenefits.length === 0 || addMut.isPending}
              onClick={handleCopyFromEmployee}
            >
              {addMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying…
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy {sourceBenefits.length} benefit{sourceBenefits.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

