import { format } from "date-fns"
import { CalendarCheck, Music, Sparkles, Tag, Users } from "lucide-react"

import { WidgetCard } from "@/components/ui"
import { useTodaysEvent } from "@/hooks/useEvents"
import { useTodaysPromotion } from "@/hooks/usePromotions"
import { useTodayReservations } from "@/hooks/useReservations"
import { useShifts } from "@/hooks/useShifts"

export function TonightCard() {
  const { data: event, isLoading: eventLoading } = useTodaysEvent()
  const { promotion } = useTodaysPromotion()

  const { data: reservations = [] } = useTodayReservations()

  // Shifts hook is week-based; filter to today.
  const { data: shifts = [] } = useShifts(new Date())

  const today = format(new Date(), "yyyy-MM-dd")
  const todaysReservations = reservations.filter(
    (r) => r.reservationDate === today && r.status !== "cancelled",
  )
  const todaysShifts = shifts.filter((s) => s.shiftDate === today)

  return (
    <WidgetCard title="Tonight at The Roof" icon={Sparkles}>
      <div className="space-y-4">
        {eventLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : event ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{event.title}</span>
            </div>
            <p className="ml-6 text-sm text-muted-foreground">
              {event.eventType?.replace("_", " ") || "Event"}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Music className="h-4 w-4" />
            <span className="text-sm">No event scheduled</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-info" />
          <span className="text-sm">
            <span className="font-medium">{todaysReservations.length}</span>
            <span className="text-muted-foreground"> reservations</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-success" />
          <span className="text-sm">
            <span className="font-medium">{todaysShifts.length}</span>
            <span className="text-muted-foreground"> staff on shift</span>
          </span>
        </div>

        {promotion ? (
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-foreground">{promotion.name}</span>
            </div>
            {promotion.description ? (
              <p className="ml-6 mt-1 line-clamp-2 text-xs text-muted-foreground">
                {promotion.description}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </WidgetCard>
  )
}

