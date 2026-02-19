import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { useUpcomingEvents } from "@/hooks/useEvents"
import { usePromotions } from "@/hooks/usePromotions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WidgetCard } from "@/components/ui/widget-card"

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

function formatShortDate(isoDate: string) {
  const d = new Date(isoDate)
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function getEventStatus(startDate: string, endDate?: string | null) {
  const today = toIsoDate(new Date())
  const end = endDate ?? startDate
  if (today < startDate) return "Upcoming"
  if (today >= startDate && today <= end) return "Live"
  return "Ended"
}

export interface EventsAndPromotionsCardProps {
  className?: string
}

export function EventsAndPromotionsCard({ className }: EventsAndPromotionsCardProps) {
  const navigate = useNavigate()
  const { data: events = [], isLoading: eventsLoading } = useUpcomingEvents(5)
  const { promotions = [], isLoading: promosLoading } = usePromotions()

  const activePromos = useMemo(() => {
    const today = toIsoDate(new Date())
    return promotions
      .filter((p) => p.isActive !== false)
      .filter((p) => {
        if (p.status === "active") return true
        if (p.status === "scheduled") return p.startDate >= today
        return false
      })
      .slice(0, 5)
  }, [promotions])

  const loading = eventsLoading || promosLoading

  return (
    <WidgetCard
      className={className}
      title="Events & promotions"
      subtitle="Next 7–14 days"
      headerAction={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/manager/events")}>
            Manage Events →
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/marketing/dashboard")}>
            Marketing Dashboard →
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming events
            </div>
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground">No upcoming events.</div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => {
                  const status = getEventStatus(e.startDate, e.endDate)
                  return (
                    <div
                      key={e.id}
                      className="flex items-start justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(e.startDate)}
                          {e.endDate && e.endDate !== e.startDate
                            ? `–${formatShortDate(e.endDate)}`
                            : ""}
                        </div>
                        <div className="truncate text-sm font-medium text-foreground">
                          {e.title}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          status === "Live"
                            ? "bg-success/10 text-success border border-success/15"
                            : status === "Upcoming"
                              ? "bg-primary/10 text-primary border border-primary/15"
                              : "bg-muted text-muted-foreground"
                        }
                      >
                        {status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active promotions
            </div>
            {activePromos.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active promotions.</div>
            ) : (
              <div className="space-y-2">
                {activePromos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-control px-2 py-2 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatShortDate(p.startDate)}
                        {p.endDate ? `–${formatShortDate(p.endDate)}` : ""}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        p.status === "active"
                          ? "bg-success/10 text-success border border-success/15"
                          : "bg-primary/10 text-primary border border-primary/15"
                      }
                    >
                      {p.status === "active" ? "Live" : "Upcoming"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

