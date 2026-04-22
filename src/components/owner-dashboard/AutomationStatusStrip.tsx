import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLastRlsAuditStatus, useSyncStatus } from "@/hooks/useDashboardData"
import { useUnreadNotificationCount } from "@/hooks/useNotifications"

type Tone = "ok" | "warn" | "bad" | "idle"

interface StatusPillProps {
  label: string
  value: string
  tone: Tone
  icon: React.ComponentType<{ className?: string }>
}

const TONE_CLASSES: Record<Tone, string> = {
  ok: "border-success/25 bg-success/8 text-success",
  warn: "border-warning/30 bg-warning/10 text-warning",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  idle: "border-border bg-secondary/40 text-muted-foreground",
}

function StatusPill({ label, value, tone, icon: Icon }: StatusPillProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs",
        TONE_CLASSES[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="uppercase tracking-widest text-[9.5px] opacity-80">{label}</span>
      <span className="font-medium text-foreground/90">{value}</span>
    </div>
  )
}

function formatHoursAgo(hours: number): string {
  if (hours < 0) return "never"
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDaysAgo(days: number): string {
  if (days < 0) return "never"
  if (days === 0) return "today"
  if (days === 1) return "1d ago"
  return `${days}d ago`
}

/**
 * One strip, three signals: sheet sync freshness, weekly RLS/drift audit
 * freshness, and count of unread operator notifications. This is the single
 * "is automation healthy" glance surface on the owner dashboard.
 */
export function AutomationStatusStrip() {
  const { data: sync, isLoading: syncLoading } = useSyncStatus()
  const { data: audit, isLoading: auditLoading } = useLastRlsAuditStatus()
  const { data: unreadCount } = useUnreadNotificationCount()

  const syncTone: Tone = (() => {
    if (syncLoading) return "idle"
    if (!sync || sync.hoursAgo < 0) return "bad"
    if (sync.status === "failed") return "bad"
    if (sync.status === "running") return "warn"
    if (sync.isStale) return "warn"
    return "ok"
  })()

  const syncValue = (() => {
    if (syncLoading) return "…"
    if (!sync) return "unknown"
    if (sync.status === "running") return "running"
    return formatHoursAgo(sync.hoursAgo)
  })()

  const auditTone: Tone = (() => {
    if (auditLoading) return "idle"
    if (!audit || audit.daysAgo < 0) return "warn"
    if (audit.status === "failed") return "bad"
    if (audit.isStale) return "warn"
    return "ok"
  })()

  const auditValue = (() => {
    if (auditLoading) return "…"
    if (!audit) return "never"
    return formatDaysAgo(audit.daysAgo)
  })()

  const alertsCount = unreadCount ?? 0
  const alertsTone: Tone = alertsCount === 0 ? "ok" : alertsCount >= 5 ? "bad" : "warn"
  const alertsValue = alertsCount === 0 ? "0 open" : `${alertsCount} open`
  const alertsIcon = alertsCount === 0 ? CheckCircle2 : AlertTriangle

  return (
    <div className="rounded-card border border-border bg-card p-3 shadow-card">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Automation Status
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label="Last Sync"
          value={syncValue}
          tone={syncTone}
          icon={Clock}
        />
        <StatusPill
          label="Last RLS Audit"
          value={auditValue}
          tone={auditTone}
          icon={ShieldCheck}
        />
        <StatusPill
          label="Open Alerts"
          value={alertsValue}
          tone={alertsTone}
          icon={alertsIcon}
        />
      </div>
    </div>
  )
}
