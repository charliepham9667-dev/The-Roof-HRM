import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface DJBooking {
  id: string
  event_id: string | null
  dj_name: string
  date: string
  start_time: string
  end_time: string
  fee: number | null
  notes: string | null
  status: "pending" | "confirmed" | "cancelled"
  created_by: string | null
  created_at: string
  updated_at: string
  event?: { id: string; title: string } | null
}

export function useDJSchedule() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ["dj_schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dj_schedule")
        .select(
          `
          *,
          event:events(id, title)
        `,
        )
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })

      if (error) throw error
      return data as DJBooking[]
    },
    enabled: !!profile,
  })

  const createBooking = useMutation({
    mutationFn: async (booking: Partial<DJBooking>) => {
      const { data, error } = await supabase
        .from("dj_schedule")
        .insert({
          ...booking,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_schedule"] })
    },
  })

  const updateBooking = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DJBooking> & { id: string }) => {
      const { data, error } = await supabase
        .from("dj_schedule")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_schedule"] })
    },
  })

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dj_schedule").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_schedule"] })
    },
  })

  return {
    bookings,
    isLoading,
    error,
    createBooking,
    updateBooking,
    deleteBooking,
  }
}

