import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type EventAttachment = {
  id: string
  event_id: string
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  label: string | null
  uploaded_by: string | null
  created_at: string
}

const BUCKET = "event-attachments"

export function useEventAttachments(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event-attachments", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventAttachment[]> => {
      if (!eventId) return []
      const { data, error } = await supabase
        .from("event_attachments")
        .select("id,event_id,file_path,file_name,mime_type,size_bytes,label,uploaded_by,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []).map((row: any) => ({
        ...row,
        size_bytes: row.size_bytes == null ? null : Number(row.size_bytes),
      }))
    },
  })
}

export function useUploadEventAttachment(eventId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async ({ file, label }: { file: File; label?: string }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      if (!eventId) throw new Error("Missing event id")
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const path = `${eventId}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from("event_attachments")
        .insert({
          event_id: eventId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          label: label || null,
          uploaded_by: profile.id,
        })
        .select("id,event_id,file_path,file_name,mime_type,size_bytes,label,uploaded_by,created_at")
        .single()
      if (error) throw error
      return data as EventAttachment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-attachments", eventId] })
    },
  })
}

export function useDeleteEventAttachment(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string }) => {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove([file_path])
      if (storageErr) throw storageErr
      const { error } = await supabase.from("event_attachments").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-attachments", eventId] })
    },
  })
}

export async function getEventAttachmentSignedUrl(path: string) {
  return supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
}
