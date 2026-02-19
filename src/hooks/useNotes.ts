import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface Note {
  id: string
  user_id: string
  content: string
  is_pinned: boolean
  color: "default" | "yellow" | "green" | "blue" | "pink" | "orange"
  created_at: string
  updated_at: string
}

export function useNotes() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ["notes", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return []

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", profile.id)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false })

      if (error) throw error
      return data as Note[]
    },
    enabled: !!profile?.id,
  })

  const createNote = useMutation({
    mutationFn: async (content: string) => {
      if (!profile?.id) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: profile.id, content })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Note> & { id: string }) => {
      const { data, error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })

  const togglePin = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { data, error } = await supabase
        .from("notes")
        .update({ is_pinned: !is_pinned })
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  }
}

