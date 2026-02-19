import { useMemo, useState } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { CalendarDays, MoreHorizontal } from "lucide-react"

import { useMeetingsForDate } from "@/hooks/useMeetings"
import { useEventsForDate } from "@/hooks/useEvents"
import { Button } from "@/components/ui/button"
import { WidgetCard } from "@/components/ui/widget-card"
import { cn } from "@/lib/utils"

type ScheduleItem = {
  id: string
  title: string
  timeLabel: string
  kind: "meeting" | "event"
}

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "All day"
  const s = start ? start.slice(0, 5) : "—"
  const e = end ? end.slice(0, 5) : ""
  return e ? `${s}–${e}` : s
}

function itemAccent(kind: ScheduleItem["kind"]) {
  return kind === "meeting" ? "bg-purple-400" : "bg-sky-400"
}

export function ExecutiveScheduleCard({ className }: { className?: string }) {
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const weekStart = useMemo(
    () => startOfWeek(selectedDay, { weekStartsOn: 1 }),
    [selectedDay],
  )

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const dayIso = useMemo(() => toIsoDate(selectedDay), [selectedDay])
  const { meetings, isLoading: meetingsLoading } = useMeetingsForDate(dayIso)
  const { data: events = [], isLoading: eventsLoading } = useEventsForDate(dayIso)

  const items = useMemo<ScheduleItem[]>(() => {
    const out: ScheduleItem[] = []
    for (const m of meetings) {
      out.push({
        id: `m:${m.id}`,
        kind: "meeting",
        title: m.title,
        timeLabel: formatTimeRange(m.startTime, m.endTime),
      })
    }
    for (const ev of events) {
      out.push({
        id: `e:${ev.id}`,
        kind: "event",
        title: ev.title,
        timeLabel: ev.isAllDay ? "All day" : formatTimeRange(ev.startTime, ev.endTime),
      })
    }

    // Sort: All day first, then time label
    return out.sort((a, b) => {
      if (a.timeLabel === "All day" && b.timeLabel !== "All day") return -1
      if (b.timeLabel === "All day" && a.timeLabel !== "All day") return 1
      return a.timeLabel.localeCompare(b.timeLabel)
    })
  }, [meetings, events])

  const loading = meetingsLoading || eventsLoading

  return (
    <WidgetCard
      className={className}
      title="Schedule"
      headerAction={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
      noPadding
    >
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{format(selectedDay, "EEEE, MMM d")}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Week
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          {days.map((d) => {
            const isSelected = toIsoDate(d) === dayIso
            return (
              <button
                key={toIsoDate(d)}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center",
                  "hover:bg-muted/40",
                  isSelected && "bg-primary/10"
                )}
              >
                <div className={cn("text-[10px] font-medium", isSelected ? "text-primary" : "text-muted-foreground")}>
                  {format(d, "EEEEE")}
                </div>
                <div className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                  {format(d, "d")}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-border">
        {loading ? (
          <div className="p-5 text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No items scheduled.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.slice(0, 5).map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                <div className={cn("h-8 w-1.5 rounded-full", itemAccent(it.kind))} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{it.timeLabel}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

