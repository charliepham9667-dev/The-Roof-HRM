import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Calendar, ChevronLeft, ChevronRight, SquareCheck } from "lucide-react"
import { addDays, format, startOfToday } from "date-fns"

import { cn } from "@/lib/utils"
import { useMeetingsForDate } from "@/hooks/useMeetings"
import { useEventsForDate } from "@/hooks/useEvents"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WidgetCard } from "@/components/ui/widget-card"

type CalendarPreviewItem = {
  id: string
  timeLabel: string
  title: string
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "All day"
  const s = start ? start.slice(0, 5) : "—"
  const e = end ? end.slice(0, 5) : ""
  return e ? `${s}–${e}` : s
}

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

export interface CalendarPreviewCardProps {
  className?: string
}

export function CalendarPreviewCard({ className }: CalendarPreviewCardProps) {
  const navigate = useNavigate()

  const [day, setDay] = useState<Date>(() => startOfToday())
  const dayIso = useMemo(() => toIsoDate(day), [day])

  const { meetings, isLoading: meetingsLoading } = useMeetingsForDate(dayIso)
  const { data: events = [], isLoading: eventLoading } = useEventsForDate(dayIso)

  const items = useMemo<CalendarPreviewItem[]>(() => {
    const out: CalendarPreviewItem[] = []

    for (const m of meetings) {
      out.push({
        id: m.id,
        timeLabel: formatTimeRange(m.startTime, m.endTime),
        title: m.title,
      })
    }

    for (const ev of events) {
      out.push({
        id: `event:${ev.id}`,
        timeLabel: ev.isAllDay
          ? "All day"
          : formatTimeRange(ev.startTime, ev.endTime),
        title: ev.title,
      })
    }

    // Sort: put All day first, then by time string
    return out.sort((a, b) => {
      if (a.timeLabel === "All day" && b.timeLabel !== "All day") return -1
      if (b.timeLabel === "All day" && a.timeLabel !== "All day") return 1
      return a.timeLabel.localeCompare(b.timeLabel)
    })
  }, [meetings, events])

  const loading = meetingsLoading || eventLoading

  return (
    <WidgetCard
      className={className}
      title="Agenda"
      headerAction={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDay(startOfToday())}
          >
            Today
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/owner/calendar")}
            aria-label="Open calendar"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between pb-3">
        <div className="text-xs text-muted-foreground">
          {format(day, "MMM d, EEE")}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setDay((d) => addDays(d, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setDay((d) => addDays(d, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No items scheduled.
        </div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 6).map((it) => (
            <div
              key={it.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-control px-2 py-2",
                "hover:bg-muted/40"
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <SquareCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 truncate text-sm text-foreground">
                  {it.title}
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {it.timeLabel}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

