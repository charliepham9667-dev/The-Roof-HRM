import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type ManagementNote = {
  id: string
  employee_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: { full_name: string | null }
}

export function useEmployeeManagementNotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["management-notes", userId],
    queryFn: async (): Promise<ManagementNote[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employee_management_notes")
        .select("id, employee_id, author_id, content, created_at, updated_at, author:profiles!author_id(full_name)")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data || []).map((row: any) => ({
        id: row.id,
        employee_id: row.employee_id,
        author_id: row.author_id,
        content: row.content,
        created_at: row.created_at,
        updated_at: row.updated_at,
        author: row.author ? { full_name: row.author.full_name } : undefined,
      })) as ManagementNote[]
    },
    enabled: !!userId,
  })
}

export function useAddManagementNote(userId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async (content: string) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("employee_management_notes")
        .insert({
          employee_id: userId,
          author_id: profile.id,
          content: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .select("id, employee_id, author_id, content, created_at, updated_at")
        .single()

      if (error) throw error
      return data as ManagementNote
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-notes", userId] })
    },
  })
}

export function useDeleteManagementNote(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("employee_management_notes")
        .delete()
        .eq("id", noteId)
        .eq("employee_id", userId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-notes", userId] })
    },
  })
}
