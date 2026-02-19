import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Plus, Users, Video } from "lucide-react"

import { Avatar, AvatarFallback, Button, WidgetCard } from "@/components/ui"
import { useTodaysMeetings } from "@/hooks/useMeetings"
import { useShifts } from "@/hooks/useShifts"
import { MiniCalendar } from "./MiniCalendar"

export function ScheduleSidebar() {
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Meetings hook is "today" scoped; calendar dots will reflect today's meeting day(s)
  const { meetings, isLoading: meetingsLoading } = useTodaysMeetings()

  // Shifts hook is week-based; filter to today.
  const { data: shifts = [] } = useShifts(new Date())
  const today = format(new Date(), "yyyy-MM-dd")
  const todaysShifts = shifts.filter((s) => s.shiftDate === today)

  const markedDates = useMemo(() => {
    const dates = meetings.map((m) => new Date(m.meetingDate))
    // Add due dates from "my tasks" later (if desired) — keeping this sidebar focused for now.
    return dates
  }, [meetings])

  return (
    <div className="space-y-4">
      <WidgetCard title="Today's Schedule" icon={Plus} noPadding>
        <div className="p-4">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            markedDates={markedDates}
          />
        </div>

        <div className="border-t border-border p-4">
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add new
          </Button>
        </div>
      </WidgetCard>

      <WidgetCard title="Meetings" icon={Video}>
        {meetingsLoading ? (
          <div className="py-4 text-center text-muted-foreground">Loading...</div>
        ) : meetings.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No meetings today</div>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(meeting.startTime || "").slice(0, 5)}
                  {meeting.endTime ? ` - ${meeting.endTime.slice(0, 5)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      <WidgetCard title="Staff on Shift" icon={Users}>
        {todaysShifts.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No shifts scheduled</div>
        ) : (
          <div className="space-y-2">
            {todaysShifts.slice(0, 6).map((shift) => (
              <div key={shift.id} className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                    {shift.staffName?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{shift.staffName || "Staff"}</p>
                  <p className="text-xs text-muted-foreground">{shift.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
    </div>
  )
}

