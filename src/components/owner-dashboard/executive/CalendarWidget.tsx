import { WidgetCard } from "@/components/ui/widget-card"
import { Calendar } from "@/components/ui/calendar"

export function CalendarWidget() {
  return (
    <WidgetCard title="Calendar" subtitle="This month" noPadding>
      <div className="p-4">
        <Calendar />
      </div>
    </WidgetCard>
  )
}

