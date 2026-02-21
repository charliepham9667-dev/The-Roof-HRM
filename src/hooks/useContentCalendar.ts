import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"
import { insertNotifications } from "@/hooks/useNotifications"

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
    onSuccess: async (post) => {
      queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
      await notifyOwnersForApproval(post, profile?.id)
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
    onSuccess: async (post, variables) => {
      queryClient.invalidateQueries({ queryKey: ["content_calendar"] })
      // Re-notify owners when a post is re-submitted for review (status set back to draft)
      if (variables.status === 'draft') {
        await notifyOwnersForApproval(post, profile?.id)
      }
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

async function notifyOwnersForApproval(post: ContentPost, createdById?: string) {
  try {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'owner')
      .eq('is_active', true)
      .eq('status', 'active')

    if (!owners || owners.length === 0) return

    const recipients = owners.filter((o: any) => o.id !== createdById)
    if (recipients.length === 0) return

    const platformLabel = post.platform === 'all' ? 'All Platforms' : post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
    const dateLabel = post.scheduled_date

    await insertNotifications(
      recipients.map((o: any) => ({
        userId: o.id,
        title: `Content needs approval: ${platformLabel} post on ${dateLabel}`,
        body: post.caption ? (post.caption.length > 80 ? `${post.caption.slice(0, 80)}…` : post.caption) : undefined,
        notificationType: 'content_approval' as const,
        relatedType: 'content_post',
        relatedId: post.id,
      }))
    )
  } catch {
    // notifications are best-effort
  }
}

