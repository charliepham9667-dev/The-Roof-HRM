import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Mail, MoreHorizontal, FileText } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"
import type { OrgMember } from "@/hooks/useOrgChart"
import { cn } from "@/lib/utils"

interface OrgChartNodeProps {
  member: OrgMember
  onSelect: (member: OrgMember) => void
  isRoot?: boolean
  editable?: boolean
  onMove?: (draggedId: string, newReportsTo: string | null) => void
}

export function OrgChartNode({
  member,
  onSelect,
  isRoot: _isRoot = false,
  editable = false,
  onMove,
}: OrgChartNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const hasReports = !!member.direct_reports && member.direct_reports.length > 0

  const initials = useMemo(() => {
    return (
      member.full_name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "?"
    )
  }, [member.full_name])

  const DEPT_COLORS: Record<string, { accent: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
    bar:        { accent: "#1565C0", badgeBg: "#EAF2FF", badgeText: "#1565C0", badgeBorder: "#90B8E8" },
    service:    { accent: "#2E7D52", badgeBg: "#E6F4EC", badgeText: "#2E7D52", badgeBorder: "#90CBA8" },
    marketing:  { accent: "#7B3F00", badgeBg: "#FEF0E3", badgeText: "#7B3F00", badgeBorder: "#E8B888" },
    management: { accent: "#8B3030", badgeBg: "#FAE8E8", badgeText: "#8B3030", badgeBorder: "#D8A0A0" },
    accountant: { accent: "#5C4080", badgeBg: "#F0EAFA", badgeText: "#5C4080", badgeBorder: "#C0A0D8" },
    owner:      { accent: "#B8922A", badgeBg: "#FBF5E6", badgeText: "#B8922A", badgeBorder: "#D4AC50" },
  }
  const deptKey = (member.department || "").trim().toLowerCase()
  const deptColors = DEPT_COLORS[deptKey] || { accent: "#6B7280", badgeBg: "#F3F4F6", badgeText: "#6B7280", badgeBorder: "#D1D5DB" }


  function onDragStart(e: React.DragEvent) {
    if (!editable) return
    e.dataTransfer.setData("text/plain", member.id)
    e.dataTransfer.effectAllowed = "move"
  }

  function onDragOver(e: React.DragEvent) {
    if (!editable) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  function onDrop(e: React.DragEvent) {
    if (!editable) return
    e.preventDefault()
    const draggedId = e.dataTransfer.getData("text/plain")
    if (!draggedId || draggedId === member.id) return
    onMove?.(draggedId, member.id)
  }

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={() => onSelect(member)}
        className={cn(
          "relative flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
          "min-w-[180px] max-w-[260px] overflow-hidden",
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-px",
          editable && "ring-1 ring-purple-600/10",
        )}
        style={{ borderTop: `3px solid ${deptColors.accent}` }}
        draggable={editable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
          <AvatarFallback className="text-xs font-bold" style={{ background: deptColors.accent, color: "#fff" }}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-foreground">{member.full_name}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">
            {member.job_role || (member.role === "owner" ? "Business Owner" : "Employee")}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {member.department && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] border"
                style={{ background: deptColors.badgeBg, color: deptColors.badgeText, borderColor: deptColors.badgeBorder }}
              >
                {member.department}
              </span>
            )}
            {member.is_active && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect(member)}>
              <FileText className="mr-2 h-4 w-4" />
              View quick profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = `/team/${member.id}`)}>
              <FileText className="mr-2 h-4 w-4" />
              View personnel file
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = `mailto:${member.email}`)}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasReports && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 rounded-full bg-muted p-1 transition-colors hover:bg-muted/80"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}

      {hasReports && expanded && <div className="h-6 w-px bg-border" />}

      {hasReports && expanded && (
        <div className="relative flex gap-8 pt-2">
          {member.direct_reports!.length > 1 && (
            <div
              className="absolute left-1/2 top-0 h-px -translate-x-1/2 bg-border"
              style={{ width: "calc(100% - 100px)" }}
            />
          )}

          {member.direct_reports!.map((report) => (
            <div key={report.id} className="flex flex-col items-center">
              <div className="h-6 w-px bg-border" />
              <OrgChartNode member={report} onSelect={onSelect} editable={editable} onMove={onMove} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

