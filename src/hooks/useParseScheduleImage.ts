import { useMutation } from "@tanstack/react-query"
import { prepareImageForParse } from "@/lib/parse-payment-list"
import { postProcessParsedSchedule, type ParsedSchedule } from "@/lib/parse-schedule"
import { supabase } from "@/lib/supabase"

function messageFromPayload(payload: unknown, status: number): string {
  const err = (payload as { error?: string } | null)?.error
  if (err) return err
  if (status === 401) return "Session expired — sign in again."
  if (status === 403) return "Only managers and owners can import schedules."
  if (status === 404) {
    return "Schedule parser is not deployed. Run: supabase functions deploy parse-schedule"
  }
  return `Schedule parse failed (HTTP ${status}).`
}

export function useParseScheduleImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParsedSchedule> => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("You must be logged in to import schedules.")

      const { base64, mimeType } = await prepareImageForParse(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120_000)

      let res: Response
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/parse-schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
          signal: controller.signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Parse timed out after 2 minutes — try a smaller screenshot.")
        }
        throw new Error(
          "Could not reach parse-schedule. Check your connection or deploy the function.",
        )
      } finally {
        clearTimeout(timeoutId)
      }

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(messageFromPayload(payload, res.status))
      }
      if ((payload as { error?: string }).error) {
        throw new Error((payload as { error: string }).error)
      }

      return postProcessParsedSchedule(payload)
    },
  })
}
