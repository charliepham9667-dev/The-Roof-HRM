import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface Meeting {
  id: string
  title: string
  agenda: string | null
  meetingDate: string
  startTime: string
  endTime: string | null
  linkedEventId: string | null
  notes: string | null
  actionItems: any[] | null
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function mapMeeting(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    agenda: row.agenda,
    meetingDate: row.meeting_date,
    startTime: row.start_time,
    endTime: row.end_time,
    linkedEventId: row.linked_event_id,
    notes: row.notes,
    actionItems: row.action_items,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useMeetings() {
  const profile = useAuthStore((s) => s.profile)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true })

      if (error) throw error
      return (data || []).map(mapMeeting)
    },
    enabled: !!profile,
  })

  return { meetings: data as Meeting[], isLoading, error }
}

export function useTodaysMeetings() {
  const profile = useAuthStore((s) => s.profile)
  const today = new Date().toISOString().split("T")[0]

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["meetings", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_date", today)
        .in("status", ["scheduled", "in_progress"])
        .order("start_time", { ascending: true })

      if (error) throw error
      return (data || []).map(mapMeeting)
    },
    enabled: !!profile,
  })

  return { meetings: data as Meeting[], isLoading, error }
}

export function useMeetingsForDate(meetingDate: string) {
  const profile = useAuthStore((s) => s.profile)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["meetings", "date", meetingDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_date", meetingDate)
        .in("status", ["scheduled", "in_progress"])
        .order("start_time", { ascending: true })

      if (error) throw error
      return (data || []).map(mapMeeting)
    },
    enabled: !!profile,
  })

  return { meetings: data as Meeting[], isLoading, error }
}

