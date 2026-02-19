import { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  PageHeader,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/components/ui"
import { useEvents, useCreateEvent, useDeleteEvent } from '../../hooks/useEvents';
import type { CalendarEvent, EventType } from '../../types';

const eventTypeConfig: Record<EventType, { label: string; color: string; bg: string }> = {
  meeting: { label: 'Meeting', color: 'text-info', bg: 'bg-info' },
  holiday: { label: 'Holiday', color: 'text-error', bg: 'bg-error' },
  birthday: { label: 'Birthday', color: 'text-pink-400', bg: 'bg-pink-500' },
  team_building: { label: 'Team Building', color: 'text-purple-400', bg: 'bg-purple-500' },
  training: { label: 'Training', color: 'text-success', bg: 'bg-success' },
  promotion: { label: 'Promotion', color: 'text-warning', bg: 'bg-warning' },
  special_event: { label: 'Special Event', color: 'text-primary', bg: 'bg-primary' },
  other: { label: 'Other', color: 'text-muted-foreground', bg: 'bg-muted' },
};

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Get first and last day of the month for query
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const { data: events, isLoading } = useEvents(
    firstDay.toISOString().split('T')[0],
    lastDay.toISOString().split('T')[0]
  );

  const navigateMonth = (delta: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // Build calendar grid
  const calendarDays = buildCalendarDays(currentDate);

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events?.filter(e => {
      const start = e.startDate;
      const end = e.endDate || e.startDate;
      return dateStr >= start && dateStr <= end;
    }) || [];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Team events, meetings, and important dates"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left sidebar (visual only) */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <Button className="w-full justify-center">
              <Plus className="mr-2 h-4 w-4" />
              Add New Event
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mini month */}
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold text-foreground">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                  const isToday = day.toDateString() === new Date().toDateString()
                  return (
                    <div
                      key={idx}
                      className={[
                        "flex h-8 items-center justify-center rounded-md text-xs",
                        isToday ? "bg-primary text-primary-foreground" : "",
                        !isToday && isCurrentMonth ? "text-foreground hover:bg-muted/60" : "",
                        !isToday && !isCurrentMonth ? "text-muted-foreground/50 hover:bg-muted/40" : "",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Calendars list */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">My Calendars</p>
              </div>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-3">
                  <Checkbox defaultChecked />
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">Personal</span>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox defaultChecked />
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm text-foreground">Work</span>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox defaultChecked />
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-pink-500" />
                    <span className="text-sm text-foreground">Family</span>
                  </div>
                </label>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Favorites</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                  Other
                </div>
              </div>
            </div>

            <div className="border-t border-border p-4">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                New Calendar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main calendar */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-2">
                  <CardTitle className="text-lg">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </CardTitle>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input className="h-9 w-full sm:w-56" placeholder="Search events..." />
                <Select defaultValue="month">
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-background/40">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                  const isToday = day.toDateString() === new Date().toDateString()
                  const dayEvents = getEventsForDate(day)

                  const isLastCol = index % 7 === 6
                  const isLastRow = index >= 35

                  return (
                    <div
                      key={index}
                      className={[
                        "relative min-h-[140px] p-3",
                        "border-b border-r border-border",
                        isLastCol ? "border-r-0" : "",
                        isLastRow ? "border-b-0" : "",
                        !isCurrentMonth ? "bg-muted/20" : "bg-card",
                        isToday ? "bg-primary/5" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={[
                            "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-medium",
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : isCurrentMonth
                                ? "text-foreground"
                                : "text-muted-foreground/60",
                          ].join(" ")}
                        >
                          {day.getDate()}
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const config = eventTypeConfig[event.eventType]
                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={[
                                "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px]",
                                "truncate transition-colors",
                                `${config.bg}/15`,
                                `${config.color}`,
                                "hover:opacity-90",
                              ].join(" ")}
                            >
                              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${config.bg}`} />
                              <span className="truncate">{event.title}</span>
                            </button>
                          )
                        })}

                        {dayEvents.length > 3 && (
                          <div className="px-2 pt-1 text-[11px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events List */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">This Month's Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events && events.length > 0 ? (
            <ScrollArea className="max-h-[360px]">
              <div className="divide-y divide-border">
                {events.map((event) => {
                  const config = eventTypeConfig[event.eventType]
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className={`mt-1 h-10 w-1 rounded-full ${config.bg}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${config.bg}/15 ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {event.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {event.startTime}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No events this month</div>
          )}
        </CardContent>
      </Card>

      {/* Event Form Modal */}
      {showForm && (
        <EventForm onClose={() => setShowForm(false)} />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function buildCalendarDays(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const days: Date[] = [];
  
  // Add days from previous month
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push(date);
  }
  
  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Add days from next month
  const endPadding = 42 - days.length;
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
}

function EventForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    eventType: 'meeting' as EventType,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    isAllDay: false,
  });
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCreateEvent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Event title is required');
      return;
    }

    try {
      await createEvent.mutateAsync(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">New Event</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type</label>
              <select
                value={formData.eventType}
                onChange={(e) => setFormData(f => ({ ...f, eventType: e.target.value as EventType }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
              >
                {Object.entries(eventTypeConfig).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g., The Roof Office"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(f => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(f => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
              />
            </div>
            {!formData.isAllDay && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isAllDay}
              onChange={(e) => setFormData(f => ({ ...f, isAllDay: e.target.checked }))}
              className="rounded border-border bg-background text-primary"
            />
            <span className="text-sm text-foreground">All day event</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createEvent.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createEvent.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventDetail({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const deleteEvent = useDeleteEvent();
  const config = eventTypeConfig[event.eventType];

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this event?')) {
      await deleteEvent.mutateAsync(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs mb-2 ${config.bg}/20 ${config.color}`}>
              {config.label}
            </span>
            <h2 className="text-lg font-semibold text-foreground">{event.title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {new Date(event.startDate).toLocaleDateString('en-US', { 
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
            })}
            {event.endDate && event.endDate !== event.startDate && (
              <> - {new Date(event.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</>
            )}
          </div>
          
          {event.startTime && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {event.startTime}{event.endTime && ` - ${event.endTime}`}
            </div>
          )}
          
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {event.location}
            </div>
          )}

          {event.description && (
            <p className="text-foreground pt-2 border-t border-border">
              {event.description}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-error hover:text-error/80"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
