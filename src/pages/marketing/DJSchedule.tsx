import { useState } from "react"
import { format } from "date-fns"

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  WidgetCard,
} from "@/components/ui"
import { Calendar, Clock, Edit, Music, Plus, Trash2 } from "lucide-react"

import { useDJSchedule, type DJBooking } from "@/hooks/useDJSchedule"
import { useUpcomingEvents } from "@/hooks/useEvents"

export default function DJSchedule() {
  const { bookings, isLoading, createBooking, updateBooking, deleteBooking } = useDJSchedule()
  const { data: events = [] } = useUpcomingEvents(100)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<DJBooking | null>(null)

  const [djName, setDjName] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [eventId, setEventId] = useState("")
  const [fee, setFee] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<"pending" | "confirmed" | "cancelled">("confirmed")

  const openModal = (booking?: DJBooking) => {
    if (booking) {
      setEditingBooking(booking)
      setDjName(booking.dj_name)
      setDate(booking.date)
      setStartTime(booking.start_time)
      setEndTime(booking.end_time)
      setEventId(booking.event_id || "")
      setFee(booking.fee?.toString() || "")
      setNotes(booking.notes || "")
      setStatus(booking.status)
    } else {
      setEditingBooking(null)
      setDjName("")
      setDate("")
      setStartTime("")
      setEndTime("")
      setEventId("")
      setFee("")
      setNotes("")
      setStatus("confirmed")
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!djName.trim() || !date || !startTime || !endTime) return

    const data = {
      dj_name: djName.trim(),
      date,
      start_time: startTime,
      end_time: endTime,
      event_id: eventId || null,
      fee: fee ? parseFloat(fee) : null,
      notes: notes.trim() || null,
      status,
    }

    try {
      if (editingBooking) {
        await updateBooking.mutateAsync({ id: editingBooking.id, ...data })
      } else {
        await createBooking.mutateAsync(data)
      }
      setModalOpen(false)
    } catch (error) {
      console.error("Failed to save booking:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this DJ booking?")) return
    try {
      await deleteBooking.mutateAsync(id)
    } catch (error) {
      console.error("Failed to delete booking:", error)
    }
  }

  const bookingsByDate = bookings.reduce((acc, booking) => {
    const dateKey = booking.date
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(booking)
    return acc
  }, {} as Record<string, DJBooking[]>)

  return (
    <div className="space-y-6">
      <PageHeader
        title="DJ Schedule"
        description="Manage DJ bookings and performances"
        actions={
          <Button onClick={() => openModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Booking
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <WidgetCard title="No Bookings" icon={Music}>
          <div className="py-8 text-center">
            <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">No DJ bookings scheduled</p>
            <Button onClick={() => openModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Booking
            </Button>
          </div>
        </WidgetCard>
      ) : (
        <div className="space-y-6">
          {Object.entries(bookingsByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, dateBookings]) => (
              <WidgetCard
                key={dateKey}
                title={format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                icon={Calendar}
              >
                <div className="space-y-3">
                  {dateBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Music className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{booking.dj_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                            </span>
                            {booking.event && (
                              <span className="text-primary">{booking.event.title}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge
                          variant={
                            booking.status === "confirmed"
                              ? "success"
                              : booking.status === "pending"
                                ? "warning"
                                : "error"
                          }
                        >
                          {booking.status}
                        </StatusBadge>
                        <Button variant="ghost" size="icon" onClick={() => openModal(booking)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-error"
                          onClick={() => handleDelete(booking.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </WidgetCard>
            ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBooking ? "Edit Booking" : "New DJ Booking"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="djName">DJ Name *</Label>
              <Input
                id="djName"
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="e.g., DJ Shadow"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event (optional)</Label>
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to event..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee">Fee (optional)</Label>
              <Input
                id="fee"
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="e.g., 2000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!djName.trim() || !date || !startTime || !endTime}>
              {editingBooking ? "Save Changes" : "Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

