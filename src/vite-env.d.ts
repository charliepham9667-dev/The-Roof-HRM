/// <reference types="vite/client" />

declare const __APP_COMMIT__: string
declare const __APP_BUILT_AT__: string

interface ImportMetaEnv {
  /**
   * Optional browser-callable Google API key used to enumerate Google Sheet
   * tabs without invoking a Supabase Edge Function. Restrict the key to your
   * production + localhost origins and the Sheets API in GCP. When unset, the
   * `list-sheet-tabs` Edge Function is used instead.
   */
  readonly VITE_GOOGLE_API_KEY?: string
}
