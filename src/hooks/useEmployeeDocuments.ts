import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type DocumentCategory = "hr" | "medical" | "certification"

export type EmployeeDocument = {
  id: string
  employee_id: string
  category: DocumentCategory
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export function useEmployeeDocuments(userId: string | undefined, category: DocumentCategory) {
  return useQuery({
    queryKey: ["employee-documents", userId, category],
    queryFn: async (): Promise<EmployeeDocument[]> => {
      if (!userId) throw new Error("Missing userId")
      const { data, error } = await supabase
        .from("employee_documents")
        .select("id, employee_id, category, file_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
        .eq("employee_id", userId)
        .eq("category", category)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        size_bytes: r.size_bytes != null ? Number(r.size_bytes) : null,
      })) as EmployeeDocument[]
    },
    enabled: !!userId,
  })
}

export function useUploadEmployeeDocument(userId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const BUCKET = "employee-documents"

  return useMutation({
    mutationFn: async ({
      category,
      file,
      fileName,
    }: {
      category: DocumentCategory
      file: File
      fileName?: string
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const name = (fileName || file.name).trim() || file.name
      const path = `${userId}/${category}/${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: meta, error: metaError } = await supabase
        .from("employee_documents")
        .insert({
          employee_id: userId,
          category,
          file_path: path,
          file_name: name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: profile.id,
        })
        .select("id, employee_id, category, file_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
        .single()

      if (metaError) throw metaError
      return meta as EmployeeDocument
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["employee-documents", userId, variables.category] })
    },
  })
}

export function useDeleteEmployeeDocument(userId: string) {
  const qc = useQueryClient()
  const BUCKET = "employee-documents"

  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string; category: DocumentCategory }) => {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([file_path])
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", id)
        .eq("employee_id", userId)

      if (dbError) throw dbError
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["employee-documents", userId, variables.category] })
    },
  })
}

export async function getDocumentDownloadUrl(filePath: string): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
  return supabase.storage.from("employee-documents").createSignedUrl(filePath, 3600)
}
