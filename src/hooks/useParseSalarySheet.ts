import { useMutation } from "@tanstack/react-query"
import {
  postProcessParsedSalary,
  prepareSalaryFileForParse,
  type ParsedSalary,
} from "@/lib/parse-salary"
import { supabaseErrorMessage } from "@/lib/finance-headroom"
import { supabase } from "@/lib/supabase"

export function useParseSalarySheet() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParsedSalary> => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("You must be logged in to import salary.")

      const { base64, mimeType } = await prepareSalaryFileForParse(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90_000)

      let res: Response
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/parse-salary-sheet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileBase64: base64, mimeType }),
          signal: controller.signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Parse timed out — try a smaller or clearer file.")
        }
        throw new Error(
          "Could not reach parse-salary-sheet. Deploy the function if this is a new environment.",
        )
      } finally {
        clearTimeout(timeoutId)
      }

      const payload = await res.json().catch(() => ({}))
      const payloadError = (payload as { error?: string }).error
      if (!res.ok) {
        throw new Error(payloadError || supabaseErrorMessage(payload, `Parse failed (HTTP ${res.status})`))
      }
      if (payloadError) {
        throw new Error(payloadError)
      }

      return postProcessParsedSalary(payload)
    },
  })
}
