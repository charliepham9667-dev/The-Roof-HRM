import { useMutation } from "@tanstack/react-query"
import {
  postProcessParsedPaymentList,
  prepareImageForParse,
  type ParsedPaymentList,
} from "@/lib/parse-payment-list"
import { supabase } from "@/lib/supabase"

function messageFromPayload(payload: unknown, status: number): string {
  const err = (payload as { error?: string } | null)?.error
  if (err) return err
  if (status === 401) return "Session expired — sign in again."
  if (status === 403) return "Only owners and admins can import payment lists."
  if (status === 404) {
    return (
      "Payment-list parser is not deployed. Run: supabase functions deploy parse-payment-list"
    )
  }
  return `Payment list parse failed (HTTP ${status}).`
}

export function useParsePaymentListImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParsedPaymentList> => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("You must be logged in to import payment lists.")

      const { base64, mimeType } = await prepareImageForParse(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120_000)

      let res: Response
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/parse-payment-list`, {
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
          "Could not reach parse-payment-list. Check your connection or deploy the function.",
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

      return postProcessParsedPaymentList(payload)
    },
  })
}
