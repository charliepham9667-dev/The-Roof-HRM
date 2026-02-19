import { format } from "date-fns"
import { Briefcase, Building, Calendar, Clock, FileText, Mail, X } from "lucide-react"

import { Avatar, AvatarFallback, Button, Separator, StatusBadge } from "@/components/ui"
import type { OrgMember } from "@/hooks/useOrgChart"
import { cn } from "@/lib/utils"

interface ProfileDetailPanelProps {
  member: OrgMember | null
  onClose: () => void
}

export function ProfileDetailPanel({ member, onClose }: ProfileDetailPanelProps) {
  if (!member) return null

  const initials =
    member.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"

  const roleColors: Record<string, { bg: string; text: string }> = {
    owner: { bg: "bg-primary/10", text: "text-primary" },
    manager: { bg: "bg-info/10", text: "text-info" },
    staff: { bg: "bg-muted", text: "text-muted-foreground" },
  }

  const roleStyle = roleColors[member.role] || roleColors.staff

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Employee</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex flex-col items-center text-center">
          <Avatar className="mb-4 h-24 w-24">
            <AvatarFallback className={cn("text-2xl font-bold", roleStyle.bg, roleStyle.text)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-xl font-semibold text-foreground">{member.full_name}</h3>
          <p className="text-muted-foreground">{member.job_role || member.role}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <StatusBadge
              variant={(member.is_active ? "success" : "warning") as any}
              className="px-3"
            >
              {member.is_active ? "Active" : "Offboarding"}
            </StatusBadge>
            <StatusBadge
              variant={member.role === "owner" ? "high" : member.role === "manager" ? "info" : "default"}
              className="px-3"
            >
              {member.role}
            </StatusBadge>
          </div>

          <div className="mt-4 w-full">
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => (window.location.href = `/team/${member.id}`)}
            >
              <FileText className="mr-2 h-4 w-4" />
              View personnel file
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Contact Information</h4>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a href={`mailto:${member.email}`} className="text-sm text-primary hover:underline">
                {member.email}
              </a>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Work Information</h4>

          {member.department && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Building className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm text-foreground">{member.department}</p>
              </div>
            </div>
          )}

          {member.job_role && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="text-sm text-foreground">{member.job_role}</p>
              </div>
            </div>
          )}

          {member.employment_type && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Employment Type</p>
                <p className="text-sm text-foreground capitalize">{member.employment_type}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p className="text-sm text-foreground">{format(new Date(member.created_at), "MMMM d, yyyy")}</p>
            </div>
          </div>
        </div>

        <Separator />

        {member.direct_reports && member.direct_reports.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">
              Direct Reports ({member.direct_reports.length})
            </h4>
            <div className="space-y-2">
              {member.direct_reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {report.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{report.full_name}</p>
                    <p className="text-xs text-muted-foreground">{report.job_role || report.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full border-purple-600/30 text-purple-700 hover:bg-purple-600/10"
            onClick={() => (window.location.href = `mailto:${member.email}`)}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
        </div>
      </div>
    </div>
  )
}

