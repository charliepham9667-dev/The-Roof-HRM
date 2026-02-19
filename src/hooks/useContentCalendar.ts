import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface ContentPost {
  id: string
  scheduled_date: string
  scheduled_time: string | null
  platform: "instagram" | "facebook" | "tiktok" | "all"
  content_type: "post" | "story" | "reel" | "video" | "carousel" | null
  caption: string | null
  media_url: string | null
  status: "draft" | "scheduled" | "published" | "cancelled"
  assigned_to: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useContentCalendar() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ["content_calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_calendar")
        .select("*")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })

      if (error) throw error
      return data as ContentPost[]
    },
    enabled: !!profile,
  })

  const createPost = useMutation({
    mutationFn: async (post: Partial<ContentPost>) => {
      const { data, error } = await supabase
        .from("content_calendar")
        .insert({
          ...post,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
    },
  })

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContentPost> & { id: string }) => {
      const { data, error } = await supabase
        .from("content_calendar")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
    },
  })

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_calendar").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
    },
  })

  return {
    posts,
    isLoading,
    error,
    createPost,
    updatePost,
    deletePost,
  }
}

