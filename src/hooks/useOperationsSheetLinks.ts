import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export type OperationsSheetKind = "purchase_request" | "payment_request" | "inventory"

export type OperationsSheetLink = {
  id: string
  kind: OperationsSheetKind
  sheet_url: string
  embed_url: string | null
  csv_export_url: string | null
  sheet_title: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Extract a spreadsheet ID from a Google Sheets URL.
 * Supports:
 *  - https://docs.google.com/spreadsheets/d/{id}/edit#gid=0
 *  - https://docs.google.com/spreadsheets/d/{id}/pubhtml
 *  - https://docs.google.com/spreadsheets/d/e/{pubId}/pubhtml  (publish-to-web)
 */
export function parseGoogleSheetUrl(input: string): {
  id: string | null
  publishId: string | null
  gid: string | null
  raw: string
} {
  const raw = input.trim()
  const publishMatch = raw.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/)
  const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  const gidMatch = raw.match(/[?&#]gid=(\d+)/)
  return {
    id: idMatch && !publishMatch ? idMatch[1] : null,
    publishId: publishMatch ? publishMatch[1] : null,
    gid: gidMatch ? gidMatch[1] : null,
    raw,
  }
}

/**
 * Derive an embeddable URL suitable for an <iframe>. For "Publish to web"
 * links we use the /pubhtml endpoint with widget=true&headers=false. For
 * normal edit URLs we fall back to /preview which also renders inline.
 */
export function deriveEmbedUrl(input: string): string | null {
  const parsed = parseGoogleSheetUrl(input)
  const widgetParams = "widget=true&headers=false&chrome=false"
  if (parsed.publishId) {
    const gidQuery = parsed.gid ? `&gid=${parsed.gid}&single=true` : ""
    return `https://docs.google.com/spreadsheets/d/e/${parsed.publishId}/pubhtml?${widgetParams}${gidQuery}`
  }
  if (parsed.id) {
    const gidQuery = parsed.gid ? `#gid=${parsed.gid}` : ""
    return `https://docs.google.com/spreadsheets/d/${parsed.id}/preview?${widgetParams}${gidQuery}`
  }
  return null
}

/**
 * Derive a CSV-export URL (Phase 2 consumption). Only works when the sheet
 * has been shared as "Anyone with the link" or published to web.
 */
export function deriveCsvExportUrl(input: string): string | null {
  const parsed = parseGoogleSheetUrl(input)
  const gid = parsed.gid ?? "0"
  if (parsed.publishId) {
    return `https://docs.google.com/spreadsheets/d/e/${parsed.publishId}/pub?output=csv&gid=${gid}&single=true`
  }
  if (parsed.id) {
    return `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${gid}`
  }
  return null
}

export function useOperationsSheetLink(kind: OperationsSheetKind) {
  return useQuery({
    queryKey: ["operations-sheet-link", kind],
    queryFn: async (): Promise<OperationsSheetLink | null> => {
      const { data, error } = await supabase
        .from("operations_sheet_links")
        .select("id,kind,sheet_url,embed_url,csv_export_url,sheet_title,updated_by,created_at,updated_at")
        .eq("kind", kind)
        .maybeSingle()
      if (error) throw error
      return (data as OperationsSheetLink | null) || null
    },
  })
}

export function useUpsertOperationsSheetLink() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  return useMutation({
    mutationFn: async (input: {
      kind: OperationsSheetKind
      sheetUrl: string
      sheetTitle?: string | null
    }) => {
      if (!profile?.id) throw new Error("Not authenticated")
      const sheetUrl = input.sheetUrl.trim()
      if (!sheetUrl) throw new Error("Sheet URL is required")
      const embedUrl = deriveEmbedUrl(sheetUrl)
      const csvExportUrl = deriveCsvExportUrl(sheetUrl)
      if (!embedUrl) {
        throw new Error(
          "That doesn't look like a Google Sheets URL. Paste the link from File > Share > Publish to web, or the /edit URL.",
        )
      }
      const { data, error } = await supabase
        .from("operations_sheet_links")
        .upsert(
          {
            kind: input.kind,
            sheet_url: sheetUrl,
            embed_url: embedUrl,
            csv_export_url: csvExportUrl,
            sheet_title: input.sheetTitle?.trim() || null,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "kind" },
        )
        .select("id,kind,sheet_url,embed_url,csv_export_url,sheet_title,updated_by,created_at,updated_at")
        .single()
      if (error) throw error
      return data as OperationsSheetLink
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["operations-sheet-link", vars.kind] })
    },
  })
}

export function useDeleteOperationsSheetLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (kind: OperationsSheetKind) => {
      const { error } = await supabase
        .from("operations_sheet_links")
        .delete()
        .eq("kind", kind)
      if (error) throw error
      return { kind }
    },
    onSuccess: (_, kind) => {
      qc.invalidateQueries({ queryKey: ["operations-sheet-link", kind] })
    },
  })
}
