import { useState } from "react"
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  markedDates?: Date[]
}

export function MiniCalendar({
  selectedDate,
  onSelectDate,
  markedDates = [],
}: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const hasMarker = (date: Date) => markedDates.some((d) => isSameDay(d, date))

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isCurrent = isSameMonth(d, currentMonth)
          const isSelected = isSameDay(d, selectedDate)
          const isToday = isSameDay(d, new Date())
          const marked = hasMarker(d)

          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={cn(
                "relative h-8 w-full rounded-md text-xs font-medium transition-colors",
                "hover:bg-muted",
                !isCurrent && "text-muted-foreground/50",
                isCurrent && "text-foreground",
                isToday && !isSelected && "bg-primary/10 text-primary",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {format(d, "d")}
              {marked && !isSelected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

