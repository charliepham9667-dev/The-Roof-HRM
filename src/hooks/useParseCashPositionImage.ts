import { useMutation } from "@tanstack/react-query"
import {
  postProcessParsedCashPosition,
  prepareImageForParse,
  type ParsedCashPosition,
} from "@/lib/parse-cash-position"
import { supabaseErrorMessage } from "@/lib/finance-headroom"
import { supabase } from "@/lib/supabase"

export function useParseCashPositionImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParsedCashPosition> => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("You must be logged in to import cash position.")

      const { base64, mimeType } = await prepareImageForParse(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90_000)

      let res: Response
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/parse-cash-position`, {
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
          throw new Error("Parse timed out — try a smaller screenshot.")
        }
        throw new Error(
          "Could not reach parse-cash-position. Deploy the function if this is a new environment.",
        )
      } finally {
        clearTimeout(timeoutId)
      }

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(supabaseErrorMessage(payload, `Parse failed (HTTP ${res.status})`))
      }

      if ((payload as { error?: string }).error) {
        throw new Error((payload as { error: string }).error)
      }

      return postProcessParsedCashPosition(payload)
    },
  })
}
