import { Loader2, Clock, User } from 'lucide-react';
import type { Shift } from '../../hooks/useShifts';

interface ShiftCalendarProps {
  weekStart: Date;
  shifts: Shift[];
  isLoading: boolean;
  onEditShift: (shiftId: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusColors: Record<string, string> = {
  scheduled: 'border-info bg-info/10',
  in_progress: 'border-success bg-success/10',
  completed: 'border-muted-foreground bg-muted/50',
  no_show: 'border-error bg-error/10',
  cancelled: 'border-muted bg-muted/30 opacity-50',
};

const roleColors: Record<string, string> = {
  server: 'text-info',
  bartender: 'text-purple-400',
  host: 'text-success',
  manager: 'text-primary',
  kitchen: 'text-warning',
  default: 'text-muted-foreground',
};

export function ShiftCalendar({ weekStart, shifts, isLoading, onEditShift }: ShiftCalendarProps) {
  // Generate array of dates for the week
  const weekDates = DAYS.map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });

  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const dateKey = shift.shiftDate;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-8 shadow-card flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDates.map((date, index) => (
          <div
            key={index}
            className={`p-3 text-center border-r border-border last:border-r-0 ${
              isToday(date) ? 'bg-primary/10' : ''
            }`}
          >
            <p className="text-xs text-muted-foreground uppercase">{DAYS[index]}</p>
            <p className={`text-lg font-semibold ${isToday(date) ? 'text-primary' : 'text-foreground'}`}>
              {date.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {weekDates.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayShifts = shiftsByDate[dateKey] || [];

          return (
            <div
              key={index}
              className={`p-2 border-r border-border last:border-r-0 ${
                isToday(date) ? 'bg-primary/5' : ''
              }`}
            >
              <div className="space-y-2">
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No shifts</p>
                ) : (
                  dayShifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => onEditShift(shift.id)}
                      className={`w-full rounded-lg border-l-2 p-2.5 md:p-2 text-left transition-colors hover:bg-muted/50 min-h-[48px] md:min-h-0 ${
                        statusColors[shift.status] || statusColors.scheduled
                      }`}
                    >
                      <div className="flex items-center gap-1.5 md:gap-1 mb-1">
                        <User className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">
                          {shift.staffName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-1">
                        <Clock className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[11px] md:text-[10px] text-muted-foreground">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </span>
                      </div>
                      <span className={`text-[11px] md:text-[10px] capitalize ${roleColors[shift.role] || roleColors.default}`}>
                        {shift.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-border bg-background">
        <span className="text-xs text-muted-foreground">Status:</span>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-info" />
          <span className="text-xs text-muted-foreground">Scheduled</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-xs text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-error" />
          <span className="text-xs text-muted-foreground">No Show</span>
        </div>
      </div>
    </div>
  );
}
