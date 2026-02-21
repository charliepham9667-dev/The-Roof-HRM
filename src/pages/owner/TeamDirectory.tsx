import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  Maximize2,
  MoreVertical,
  Plus,
  Search,
  Users,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"

import { useStaffList, useTodayShifts, usePendingProfiles, useShifts } from "../../hooks/useShifts"
import type { UserRole, JobRole, EmploymentType } from "../../types"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"
import { OrgChartNode, ProfileDetailPanel } from "@/components/org-chart"
import { AddEmployeeModal } from "@/components/team/AddEmployeeModal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateEmployeeProfile } from "@/hooks/useEmployees"
import { useOrgChart, useUpdateReportsTo, type OrgMember } from "@/hooks/useOrgChart"

// ── Types ──────────────────────────────────────────────────────────────────────

type DirectoryProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  phone?: string | null
  hire_date?: string | null
  avatar_url?: string | null
  job_role?: string | null
  employment_type?: string | null
  manager_type?: string | null
  department?: string | null
  reports_to?: string | null
}

// ── Department theme ───────────────────────────────────────────────────────────

type DeptTheme = {
  accent: string
  sectionBg: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
}

const DEPT_THEME: Record<string, DeptTheme> = {
  bar:        { accent: "#1565C0", sectionBg: "#EAF2FF", badgeBg: "#EAF2FF", badgeBorder: "#90B8E8", badgeText: "#1565C0" },
  service:    { accent: "#2E7D52", sectionBg: "#E6F4EC", badgeBg: "#E6F4EC", badgeBorder: "#90CBA8", badgeText: "#2E7D52" },
  marketing:  { accent: "#7B3F00", sectionBg: "#FEF0E3", badgeBg: "#FEF0E3", badgeBorder: "#E8B888", badgeText: "#7B3F00" },
  management: { accent: "#8B3030", sectionBg: "#FAE8E8", badgeBg: "#FAE8E8", badgeBorder: "#D8A0A0", badgeText: "#8B3030" },
  accountant: { accent: "#5C4080", sectionBg: "#F0EAFA", badgeBg: "#F0EAFA", badgeBorder: "#C0A0D8", badgeText: "#5C4080" },
  owner:      { accent: "#B8922A", sectionBg: "#FBF5E6", badgeBg: "#FBF5E6", badgeBorder: "#D4AC50", badgeText: "#B8922A" },
  other:      { accent: "#6B7280", sectionBg: "#F3F4F6", badgeBg: "#F3F4F6", badgeBorder: "#D1D5DB", badgeText: "#6B7280" },
}

function getDeptTheme(dept: string | null | undefined): DeptTheme {
  const key = (dept || "").trim().toLowerCase()
  return DEPT_THEME[key] ?? DEPT_THEME.other
}

// ── Department order ───────────────────────────────────────────────────────────

const DEPT_ORDER = ["Owner", "Management", "Bar", "Service", "Marketing", "Accountant"]

function normalizeDepartment(dept: string | null | undefined) {
  return String(dept ?? "").trim()
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const todayIso = new Date().toISOString().slice(0, 10)

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function parseTimeMins(t: string) {
  const [h, m] = t.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function isActiveNow(start: string, end: string) {
  const now = new Date()
  const nowM = now.getHours() * 60 + now.getMinutes()
  const s = parseTimeMins(start)
  const e = parseTimeMins(end)
  if (e < s) return nowM >= s || nowM <= e
  return nowM >= s && nowM <= e
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TeamDirectory() {
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [shiftFilter, setShiftFilter] = useState<string>("all")
  const [view, setView] = useState<"list" | "org" | "pending">("list")
  const [addOpen, setAddOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<{ id: string; name: string; email: string } | null>(null)

  const { data: staffList, isLoading } = useStaffList()
  const { data: todayShifts } = useTodayShifts(todayIso)
  const { data: pendingProfiles, isLoading: pendingLoading } = usePendingProfiles()
  const { data: weekShifts = [] } = useShifts(new Date())
  const queryClient = useQueryClient()

  // Build staffId → total scheduled hours this week
  const weekHoursMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of weekShifts) {
      if (!s.staffId) continue
      const start = s.startTime ?? ""
      const end = s.endTime ?? ""
      if (!start || !end) continue
      const startMins = parseTimeMins(start)
      let endMins = parseTimeMins(end)
      if (endMins <= startMins) endMins += 24 * 60 // overnight shift
      const hrs = Math.max(0, endMins - startMins) / 60
      map.set(s.staffId, (map.get(s.staffId) ?? 0) + hrs)
    }
    return map
  }, [weekShifts])

  const allStaff = (staffList ?? []) as DirectoryProfile[]

  const onShiftNowIds = useMemo(() => {
    const ids = new Set<string>()
    if (!todayShifts) return ids
    for (const s of todayShifts) {
      const empId = (s as any).staffId ?? (s as any).staff_id
      if (!empId) continue
      const start: string = (s as any).startTime ?? (s as any).start_time ?? ""
      const end: string = (s as any).endTime ?? (s as any).end_time ?? ""
      if (start && end && isActiveNow(start, end)) ids.add(empId)
    }
    return ids
  }, [todayShifts])

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const p of allStaff) {
      const d = normalizeDepartment(p.department)
      if (d) set.add(d)
    }
    return Array.from(set).sort((a, b) => {
      const ia = DEPT_ORDER.indexOf(a)
      const ib = DEPT_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
  }, [allStaff])

  const stats = useMemo(() => ({
    total: allStaff.length,
    onNow: onShiftNowIds.size,
    managers: allStaff.filter((s) => s.role === "manager" || s.role === "owner").length,
  }), [allStaff, onShiftNowIds])

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allStaff.filter((p) => {
      if (q && !(p.full_name ?? "").toLowerCase().includes(q) && !(p.email ?? "").toLowerCase().includes(q)) return false
      if (departmentFilter !== "all" && normalizeDepartment(p.department) !== departmentFilter) return false
      if (typeFilter !== "all") {
        const et = (p.employment_type ?? "").toLowerCase().replace(/[_\s-]/g, "")
        if (typeFilter === "full" && !et.includes("full")) return false
        if (typeFilter === "part" && !et.includes("part")) return false
      }
      if (shiftFilter === "on" && !onShiftNowIds.has(p.id)) return false
      if (shiftFilter === "off" && onShiftNowIds.has(p.id)) return false
      return true
    })
  }, [allStaff, searchQuery, departmentFilter, typeFilter, shiftFilter, onShiftNowIds])

  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, DirectoryProfile[]>()
    for (const p of filteredStaff) {
      const dept = normalizeDepartment(p.department) || "Other"
      const arr = map.get(dept) ?? []
      arr.push(p)
      map.set(dept, arr)
    }
    const roleRank: Record<UserRole, number> = { owner: 0, manager: 1, staff: 2 }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ra = roleRank[a.role] ?? 99
        const rb = roleRank[b.role] ?? 99
        if (ra !== rb) return ra - rb
        return (a.full_name ?? "").localeCompare(b.full_name ?? "")
      })
    }
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => {
      const ia = DEPT_ORDER.indexOf(a)
      const ib = DEPT_ORDER.indexOf(b)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      if (a === "Other") return 1
      if (b === "Other") return -1
      return a.localeCompare(b)
    })
    return entries.map(([department, people]) => ({ department, people }))
  }, [filteredStaff])

  const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-foreground">Team Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">View your organisation and manage employee profiles</p>
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#EDE8DD", border: "1px solid #E0D8C8", borderRadius: 6, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setView("list")}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: "none", transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                background: view === "list" ? "#FDFAF5" : "transparent",
                color: view === "list" ? "#1A1814" : "#7A7260",
                boxShadow: view === "list" ? "0 1px 3px rgba(0,0,0,.07)" : "none",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              List view
            </button>
            <button
              type="button"
              onClick={() => setView("org")}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: "none", transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                background: view === "org" ? "#FDFAF5" : "transparent",
                color: view === "org" ? "#1A1814" : "#7A7260",
                boxShadow: view === "org" ? "0 1px 3px rgba(0,0,0,.07)" : "none",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="14" width="6" height="4" rx="1"/><rect x="16" y="14" width="6" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="5" y1="14" x2="5" y2="10"/><line x1="19" y1="14" x2="19" y2="10"/><line x1="5" y1="10" x2="19" y2="10"/></svg>
              Organisation chart
            </button>
            <button
              type="button"
              onClick={() => setView("pending")}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: "none", transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                background: view === "pending" ? "#FBF5E6" : "transparent",
                color: view === "pending" ? "#B8922A" : "#7A7260",
                boxShadow: view === "pending" ? "0 1px 3px rgba(0,0,0,.07)" : "none",
              }}
            >
              <Clock size={12} />
              Pending
              {(pendingProfiles?.length ?? 0) > 0 && (
                <span style={{ background: "#B8922A", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px", lineHeight: 1.4 }}>
                  {pendingProfiles!.length}
                </span>
              )}
            </button>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus size={14} />
          + Add Employee
        </Button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ padding: "7px 13px" }}>
        <StatCard
          label="Total"
          value={stats.total}
          sub="Full-time & part-time"
          icon={<Users size={13} color="#7A7260" />}
          noRightBorder
        />
        <StatCard
          label="On Shift Now"
          value={stats.onNow}
          sub={`Active right now · ${nowTime}`}
          icon={<Clock size={13} color="#3D6B4A" />}
          live
          noRightBorder
        />
        <StatCard
          label="Scheduled This Week"
          value={stats.total}
          sub={`${Math.max(0, allStaff.length - stats.onNow)} unscheduled`}
          icon={<Calendar size={13} color="#7A7260" />}
        />
        <StatCard
          label="Managers"
          value={stats.managers}
          sub="GM · Floor · Supervisor · Mkt"
          icon={<Briefcase size={13} color="#7A7260" />}
          noRightBorder
          padding="13px 16px"
        />
      </div>

      {view === "list" && (
        <>
          {/* ── Dept chips ──────────────────────────────────────────────── */}
          <div style={{ padding: "10px 24px", background: "rgba(255, 255, 255, 1)", borderBottom: "1px solid rgba(255, 255, 255, 1)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", color: "#7A7260", fontWeight: 600, marginRight: 4 }}>Departments</span>
            {departments.map((d) => {
              const t = getDeptTheme(d)
              const active = departmentFilter === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartmentFilter(active ? "all" : d)}
                  style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .12s", fontFamily: "'DM Sans', sans-serif",
                    background: active ? t.accent : t.badgeBg,
                    color: active ? "#fff" : t.badgeText,
                    border: `1px solid ${t.badgeBorder}`,
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>

          {/* ── Filter bar ──────────────────────────────────────────────── */}
          <div style={{ padding: "10px 24px", background: "rgba(255, 255, 255, 1)", borderBottom: "1px solid rgba(255, 255, 255, 1)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#F4EFE6", border: "1px solid #E0D8C8", borderRadius: 6, padding: "6px 12px", flex: 1, maxWidth: 320 }}>
              <Search size={13} color="#A89E8C" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employees…"
                style={{ border: "none", outline: "none", background: "none", fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: "#1A1814", width: "100%" }}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid #E0D8C8", borderRadius: 6, fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: "#FDFAF5", color: "#4A4538", outline: "none", cursor: "pointer" }}
            >
              <option value="">All types</option>
              <option value="full">Full-time</option>
              <option value="part">Part-time</option>
            </select>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid #E0D8C8", borderRadius: 6, fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: "#FDFAF5", color: "#4A4538", outline: "none", cursor: "pointer" }}
            >
              <option value="">All staff</option>
              <option value="on">On shift now</option>
              <option value="off">Off shift</option>
            </select>
          </div>

          {/* ── Content ─────────────────────────────────────────────────── */}
          <div style={{ padding: "20px 24px" }}>
            {isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={{ background: "#FDFAF5", border: "1px solid #E0D8C8", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div style={{ flex: 1 }} className="space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <Skeleton className="h-14 rounded-md" />
                      <Skeleton className="h-14 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStaff.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#A89E8C", fontSize: 13 }}>
                No employees match your filters.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {groupedByDepartment.map(({ department, people }) => {
                  const t = getDeptTheme(department)
                  return (
                    <section key={department}>
                      {/* Department header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginBottom: 12, paddingBottom: 8,
                        borderBottom: `1px solid #E5E7EB`,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
                          {department}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 9999,
                          background: "#F3F4F6", color: "#6B7280",
                        }}>
                          {people.length}
                        </span>
                      </div>

                      {/* Cards grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                        {people.map((person) => (
                          <TeamMemberCard
                            key={person.id}
                            person={person}
                            isOnNow={onShiftNowIds.has(person.id)}
                            deptTheme={t}
                            weekHrs={Math.round((weekHoursMap.get(person.id) ?? 0) * 10) / 10}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === "org" && (
        <div style={{ padding: "20px 24px" }}>
          <OrgChartInline />
        </div>
      )}

      {view === "pending" && (
        <div style={{ padding: "20px 24px" }}>
          {pendingLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 className="animate-spin" size={24} color="#A89E8C" />
            </div>
          ) : !pendingProfiles || pendingProfiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#A89E8C" }}>
              <CheckCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No pending approvals</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>All sign-up requests have been reviewed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
              <p style={{ fontSize: 12, color: "#7A7260", marginBottom: 4 }}>
                {pendingProfiles.length} staff member{pendingProfiles.length !== 1 ? "s" : ""} awaiting your approval
              </p>
              {pendingProfiles.map((p) => {
                const name = p.full_name ?? "Unknown"
                const email = p.email ?? ""
                const signedUp = p.created_at
                  ? new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 14, background: "#FDFAF5", border: "1px solid #E0D8C8",
                    borderRadius: 8, padding: "12px 16px",
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", background: "#EDE8DD", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                      color: "#B8922A", flexShrink: 0,
                    }}>
                      {initials(name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1814" }}>{name}</div>
                      <div style={{ fontSize: 12, color: "#7A7260" }}>{email}</div>
                      <div style={{ fontSize: 11, color: "#A89E8C", marginTop: 2 }}>Signed up {signedUp}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setApproveTarget({ id: p.id, name, email })}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                          background: "#3D6B4A", color: "#fff", border: "none", borderRadius: 6,
                          fontSize: 12, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <RejectButton profileId={p.id} onDone={() => queryClient.invalidateQueries({ queryKey: ['pending-profiles'] })} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AddEmployeeModal isOpen={addOpen} onClose={() => setAddOpen(false)} />

      {approveTarget && (
        <ApproveModal
          profile={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={() => {
            setApproveTarget(null)
            queryClient.invalidateQueries({ queryKey: ['pending-profiles'] })
            queryClient.invalidateQueries({ queryKey: ['staff-list'] })
          }}
        />
      )}
    </div>
  )
}

// ── Reject button ──────────────────────────────────────────────────────────────

function RejectButton({ profileId, onDone }: { profileId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const handleReject = async () => {
    if (!confirm("Reject this sign-up request? The user will be informed they were not approved.")) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected' })
      .eq('id', profileId)
    setLoading(false)
    if (error) {
      toast.error("Failed to reject: " + error.message)
    } else {
      toast.success("Request rejected.")
      onDone()
    }
  }
  return (
    <button
      type="button"
      onClick={handleReject}
      disabled={loading}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
        background: "#FAE8E8", color: "#8B3030", border: "1px solid #D8A0A0", borderRadius: 6,
        fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={13} />}
      Reject
    </button>
  )
}

// ── Approve modal ──────────────────────────────────────────────────────────────

const JOB_ROLES: JobRole[] = [
  'bartender', 'head_bartender', 'service', 'waiter', 'supervisor',
  'floor_manager', 'general_manager', 'receptionist', 'host',
  'videographer', 'marketing_manager', 'bar_manager', 'accountant',
]

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'casual', label: 'Casual' },
]

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
]

function ApproveModal({
  profile,
  onClose,
  onApproved,
}: {
  profile: { id: string; name: string; email: string }
  onClose: () => void
  onApproved: () => void
}) {
  const [role, setRole] = useState<UserRole>('staff')
  const [jobRole, setJobRole] = useState<JobRole | ''>('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')
  const [department, setDepartment] = useState('')
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        is_active: true,
        role,
        job_role: jobRole || null,
        employment_type: employmentType,
        department: department || null,
        hire_date: hireDate || null,
      })
      .eq('id', profile.id)
    setLoading(false)
    if (error) {
      toast.error("Failed to approve: " + error.message)
    } else {
      toast.success(`${profile.name} has been approved and can now access their dashboard.`)
      onApproved()
    }
  }

  const fieldStyle: React.CSSProperties = {
    padding: "7px 10px", border: "1px solid #E0D8C8", borderRadius: 6,
    fontSize: 12.5, fontFamily: "'DM Sans', sans-serif",
    background: "#FDFAF5", color: "#1A1814", outline: "none", width: "100%",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "#7A7260",
    textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4, display: "block",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#FDFAF5", borderRadius: 12, width: "100%", maxWidth: 480,
        border: "1px solid #E0D8C8", boxShadow: "0 20px 60px rgba(0,0,0,.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E0D8C8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, margin: 0, color: "#1A1814" }}>
              Approve Staff Member
            </h2>
            <p style={{ fontSize: 12, color: "#7A7260", margin: "2px 0 0" }}>Assign role and details before granting access</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#A89E8C", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Employee info */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#EDE8DD", borderRadius: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#B8922A22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#B8922A" }}>
              {initials(profile.name)}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1814" }}>{profile.name}</div>
              <div style={{ fontSize: 12, color: "#7A7260" }}>{profile.email}</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>System Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={fieldStyle}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Employment Type</label>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} style={fieldStyle}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Job Role</label>
            <select value={jobRole} onChange={(e) => setJobRole(e.target.value as JobRole | '')} style={fieldStyle}>
              <option value="">— Select job role —</option>
              {JOB_ROLES.map((jr) => (
                <option key={jr} value={jr}>{jr.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Bar, Service…"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hire Date</label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E0D8C8" }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #E0D8C8", borderRadius: 6, background: "none", fontSize: 12.5, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#4A4538" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            style={{ padding: "8px 18px", background: "#3D6B4A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            Approve & Grant Access
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, live, noRightBorder, padding,
}: {
  label: string; value: number; sub?: string; icon?: React.ReactNode; live?: boolean; noRightBorder?: boolean; padding?: string
}) {
  return (
    <div style={{ padding: padding ?? "14px 20px", border: "1px solid #E0D8C8", borderRight: noRightBorder ? "none" : "1px solid #E0D8C8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", color: live ? "#3D6B4A" : "#7A7260", fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, lineHeight: 1, color: live ? "#3D6B4A" : "#1A1814" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#A89E8C", marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Employee card ──────────────────────────────────────────────────────────────

function TeamMemberCard({
  person, isOnNow, deptTheme, weekHrs,
}: {
  person: DirectoryProfile
  isOnNow: boolean
  deptTheme: DeptTheme
  weekHrs: number
}) {
  const displayName = person.full_name ?? "Unnamed"
  const displayEmail = person.email ?? ""
  const [removeOpen, setRemoveOpen] = useState(false)
  const updateProfile = useUpdateEmployeeProfile(person.id)
  const maxHrs = person.role === "owner" ? 50 : 40
  const hrsPct = Math.min(100, Math.round((weekHrs / maxHrs) * 100))
  const hrsColor = hrsPct > 90 ? "#8B3030" : hrsPct > 60 ? "#3D6B4A" : "#B8922A"

  const isManager = person.role === "owner" || person.role === "manager"
  const jobLabel = person.job_role
    ? person.job_role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  const hireDisplay = person.hire_date
    ? new Date(person.hire_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null

  return (
    <div
      style={{
        background: "#FDFAF5",
        border: "1px solid #E0D8C8",
        borderRadius: 12,
        borderTop: `3px solid ${deptTheme.accent}`,
        cursor: "pointer",
        transition: "all .15s",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 2px 0 rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 3px 12px rgba(0,0,0,.07)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)" }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none" }}
    >
      <Link to={`/team/${person.id}`} style={{ display: "block", padding: 14, textDecoration: "none", color: "inherit" }}>
        {/* Top row: avatar + info + menu */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Avatar className="h-9 w-9" style={{ width: 36, height: 36 }}>
              <AvatarImage src={person.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback style={{ background: deptTheme.accent, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            {isOnNow && (
              <span style={{
                position: "absolute", inset: -2, borderRadius: "50%",
                border: "2px solid #3D6B4A",
                animation: "rpulse 2s infinite",
              }} />
            )}
          </div>

          {/* Name + role + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1814", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11.5, color: "#7A7260", marginTop: 1 }}>{jobLabel ?? ""}</div>
            <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".04em", background: deptTheme.badgeBg, color: deptTheme.badgeText, border: `1px solid ${deptTheme.badgeBorder}` }}>
                {person.department ?? "—"}
              </span>
              {isManager && (
                <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".04em", background: "#F5EEE0", color: "#7A5820", border: "1px solid #D8CAAC" }}>
                  Manager
                </span>
              )}
              {person.employment_type && (
                <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".04em", background: "#EDE8DD", color: "#7A7260", border: "1px solid #E0D8C8" }}>
                  {person.employment_type.replace(/[_-]/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#A89E8C", cursor: "pointer", background: "transparent", border: "none", flexShrink: 0 }}
              >
                <MoreVertical size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoveOpen(true)}>
                Remove from team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* KPI grid: week hours + joined */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <div style={{ background: "#F4EFE6", border: "1px solid #E0D8C8", borderRadius: 5, padding: "7px 9px" }}>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".07em", color: "#7A7260", fontWeight: 600, marginBottom: 2 }}>Week Hours</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: hrsColor, fontFamily: "'DM Mono', monospace" }}>{weekHrs}h</div>
            <div style={{ height: 3, background: "#E0D8C8", borderRadius: 2, marginTop: 4 }}>
              <div style={{ height: 3, borderRadius: 2, background: hrsColor, width: `${hrsPct}%` }} />
            </div>
            <div style={{ fontSize: 9.5, color: "#A89E8C", marginTop: 2 }}>of {maxHrs}h target</div>
          </div>
          <div style={{ background: "#F4EFE6", border: "1px solid #E0D8C8", borderRadius: 5, padding: "7px 9px" }}>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".07em", color: "#7A7260", fontWeight: 600, marginBottom: 2 }}>Joined</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1814" }}>{hireDisplay ?? "—"}</div>
            <div style={{ fontSize: 9.5, color: "#A89E8C" }}>Start date</div>
          </div>
        </div>

        {/* On shift bar */}
        {isOnNow && (
          <div style={{ background: "#EBF2ED", border: "1px solid #C0D8C8", borderRadius: 5, padding: "5px 9px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#3D6B4A", fontWeight: 500, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3D6B4A", animation: "rpulse 1.5s infinite", flexShrink: 0, display: "inline-block" }} />
            On shift right now
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 9, borderTop: "1px solid #E0D8C8" }}>
          {displayEmail && (
            <span style={{ fontSize: 11, color: "#7A7260", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
              <Mail size={11} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{displayEmail}</span>
            </span>
          )}
        </div>
      </Link>

      {/* Remove dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-md" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
          <DialogHeader>
            <DialogTitle>Remove staff member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This will deactivate <span className="font-semibold">{displayName}</span>. They'll be removed from Team Overview and won't appear in scheduling lists.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={updateProfile.isPending}>Cancel</Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={updateProfile.isPending}
                onClick={() => {
                  updateProfile.mutate({ is_active: false }, {
                    onSuccess: () => { toast.success("Staff removed"); setRemoveOpen(false) },
                    onError: (err) => toast.error((err as Error)?.message ?? "Failed to remove staff"),
                  })
                }}
              >
                {updateProfile.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Org chart ──────────────────────────────────────────────────────────────────

function OrgChartInline() {
  const { members, orgTree, isLoading, error } = useOrgChart()
  const [selected, setSelected] = useState<OrgMember | null>(null)
  const [zoom, setZoom] = useState(100)
  const [editMode, setEditMode] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [unassignedQuery, setUnassignedQuery] = useState("")
  const [moveMessage, setMoveMessage] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const updateReportsTo = useUpdateReportsTo()

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of members) {
      if (!m.reports_to) continue
      const arr = map.get(m.reports_to) ?? []
      arr.push(m.id)
      map.set(m.reports_to, arr)
    }
    return map
  }, [members])

  const filteredPickerMembers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => (m.full_name ?? "").toLowerCase().includes(q))
  }, [members, pickerQuery])

  const inTreeIds = useMemo(() => collectTreeIds(orgTree), [orgTree])
  const unassignedMembers = useMemo(() => {
    const q = unassignedQuery.trim().toLowerCase()
    const list = members.filter((m) => !inTreeIds.has(m.id))
    if (!q) return list
    return list.filter((m) => (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q))
  }, [members, inTreeIds, unassignedQuery])

  function isDescendant(ancestorId: string, maybeDescendantId: string): boolean {
    const stack = [...(childrenMap.get(ancestorId) ?? [])]
    const seen = new Set<string>()
    while (stack.length) {
      const cur = stack.pop()!
      if (cur === maybeDescendantId) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const k of childrenMap.get(cur) ?? []) stack.push(k)
    }
    return false
  }

  function handleMove(draggedId: string, newReportsTo: string | null) {
    setMoveMessage(null)
    setMoveError(null)
    if (newReportsTo === draggedId) { setMoveError("You can't report to yourself."); return }
    if (newReportsTo && isDescendant(draggedId, newReportsTo)) { setMoveError("Invalid move: that would create a reporting cycle."); return }
    updateReportsTo.mutate(
      { memberId: draggedId, reportsTo: newReportsTo },
      { onSuccess: () => setMoveMessage("Org chart updated."), onError: (err) => setMoveError((err as Error)?.message ?? "Failed to update org chart.") },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-sm text-muted-foreground">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(150, z + 10))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(100)}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            className={editMode ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-600/30 text-purple-700 hover:bg-purple-600/10"}
            onClick={() => { setEditMode((v) => !v); setMoveMessage(null); setMoveError(null) }}
          >
            {editMode ? "Editing" : "Edit chart"}
          </Button>
        </div>
        <div className="w-full sm:w-[360px] space-y-2">
          <Input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Filter employees…" />
          <Select value={selected?.id ?? "all"} onValueChange={(v) => { if (v === "all") return setSelected(null); setSelected(members.find((x) => x.id === v) ?? null) }}>
            <SelectTrigger><SelectValue placeholder="Select an employee…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select…</SelectItem>
              {filteredPickerMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(moveMessage || moveError || editMode) && (
        <div className="space-y-2">
          {editMode && <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 px-3 py-2 text-sm text-purple-800">Drag an employee card onto another to change reporting. Drop onto "Top level" to remove a manager.</div>}
          {moveMessage && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{moveMessage}</div>}
          {moveError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{moveError}</div>}
        </div>
      )}

      {editMode && (
        <div className="rounded-xl border border-dashed border-purple-600/30 bg-card px-4 py-3 text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { if (!editMode) return; e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) handleMove(id, null) }}>
          Top level (drop here to remove manager)
        </div>
      )}

      {editMode && unassignedMembers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Unassigned team members</div>
              <div className="text-xs text-muted-foreground">Drag onto the chart to assign reporting.</div>
            </div>
            <Input className="w-full sm:w-[280px]" value={unassignedQuery} onChange={(e) => setUnassignedQuery(e.target.value)} placeholder="Search unassigned…" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedMembers.slice(0, 12).map((m) => (
              <div key={m.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", m.id); e.dataTransfer.effectAllowed = "move" }}
                className="flex cursor-grab items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 hover:border-purple-600/30 hover:bg-purple-600/5 active:cursor-grabbing">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url ?? undefined} alt={m.full_name ?? ""} />
                  <AvatarFallback className="text-xs font-semibold">{initials(m.full_name ?? m.email ?? "?")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.full_name ?? m.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.job_role ?? m.department ?? "Employee"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-muted/20">
        {isLoading ? (
          <div className="flex h-[520px] items-center justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
        ) : error ? (
          <div className="flex h-[520px] items-center justify-center"><p className="text-destructive">Failed to load organization chart</p></div>
        ) : !orgTree ? (
          <div className="flex h-[520px] flex-col items-center justify-center">
            <Users className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <p className="text-muted-foreground">No team members found</p>
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <div className="flex min-h-full justify-center p-8" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
              <OrgChartNode member={orgTree} onSelect={setSelected} isRoot editable={editMode} onMove={handleMove} />
            </div>
          </ScrollArea>
        )}
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelected(null)} />
          <ProfileDetailPanel member={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  )
}

function collectTreeIds(root: OrgMember | null): Set<string> {
  const set = new Set<string>()
  if (!root) return set
  const stack: OrgMember[] = [root]
  while (stack.length) {
    const cur = stack.pop()!
    set.add(cur.id)
    for (const k of cur.direct_reports ?? []) stack.push(k)
  }
  return set
}

// ── Pulse keyframe injected once ──────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("rpulse-style")) {
  const s = document.createElement("style")
  s.id = "rpulse-style"
  s.textContent = `@keyframes rpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.06)}}`
  document.head.appendChild(s)
}
