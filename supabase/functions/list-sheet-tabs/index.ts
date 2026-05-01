// Supabase Edge Function: list-sheet-tabs
//
// Returns the list of tabs (sheets) inside a Google Spreadsheet so the
// browser can fetch each tab's CSV individually and roll up an aggregate.
// The browser can't do this discovery itself because docs.google.com pages
// don't ship CORS headers — so /pubhtml HTML scraping always fails when
// invoked from the front-end. This function runs server-side (no CORS) and
// uses two fallbacks in order:
//   1. Google Sheets API v4 with GOOGLE_API_KEY (works for sheets shared
//      "anyone with link can view")
//   2. Scraping the public /pubhtml page (works for "Publish to web" sheets)
//
// Request:  POST { sheetUrl: string }
// Response: { tabs: Array<{ gid: string; name: string }> }
//
// Errors are returned as { error: string } with non-200 status.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Tab = { gid: string; name: string }

function parseSheetUrl(input: string): {
  id: string | null
  publishId: string | null
} {
  const raw = input.trim()
  const publishMatch = raw.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/)
  const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return {
    id: idMatch && !publishMatch ? idMatch[1] : null,
    publishId: publishMatch ? publishMatch[1] : null,
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function tabsViaApi(id: string, apiKey: string): Promise<Tab[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${apiKey}&fields=sheets.properties(sheetId,title,hidden)`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const sheets: any[] = Array.isArray(data?.sheets) ? data.sheets : []
  const tabs: Tab[] = []
  for (const sheet of sheets) {
    const props = sheet?.properties || {}
    if (props.hidden) continue
    const sheetId = props.sheetId
    const title = props.title
    if (sheetId == null || !title) continue
    tabs.push({ gid: String(sheetId), name: String(title) })
  }
  return tabs
}

async function tabsViaPubhtml(htmlUrl: string): Promise<Tab[]> {
  const res = await fetch(htmlUrl, { headers: { "User-Agent": "Mozilla/5.0" } })
  if (!res.ok) return []
  const html = await res.text()
  const tabs: Tab[] = []
  const seen = new Set<string>()

  // Google's pubhtml exposes a tab strip near the bottom: an <li> per tab
  // with id="sheet-button-<gid>" containing the visible name in an <a>.
  const liRegex = /id="sheet-button-(\d+)"[^>]*>\s*(?:<[^>]+>\s*)*<a[^>]*>([^<]*)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = liRegex.exec(html)) !== null) {
    const gid = match[1]
    const name = decodeHtmlEntities(match[2].trim())
    if (!gid || seen.has(gid)) continue
    seen.add(gid)
    tabs.push({ gid, name })
  }

  // Older format: anchor links carrying gid query strings around the page.
  const anchorRegex = /<a[^>]*href="[^"]*[?&]gid=(\d+)[^"]*"[^>]*>([^<]*)<\/a>/gi
  while ((match = anchorRegex.exec(html)) !== null) {
    const gid = match[1]
    const name = decodeHtmlEntities((match[2] || "").trim())
    if (!gid || seen.has(gid) || !name) continue
    seen.add(gid)
    tabs.push({ gid, name })
  }

  return tabs
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let body: { sheetUrl?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const sheetUrl = typeof body.sheetUrl === "string" ? body.sheetUrl.trim() : ""
  if (!sheetUrl) {
    return new Response(JSON.stringify({ error: "sheetUrl is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const parsed = parseSheetUrl(sheetUrl)
  if (!parsed.id && !parsed.publishId) {
    return new Response(
      JSON.stringify({ error: "Not a recognised Google Sheets URL" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }

  const apiKey = Deno.env.get("GOOGLE_API_KEY")
  let tabs: Tab[] = []
  let lastErr: string | null = null

  // Path 1: Sheets API v4 — only works when we have the regular spreadsheet
  // id (not just a /e/ pubhtml id) and an API key is configured.
  if (parsed.id && apiKey) {
    try {
      tabs = await tabsViaApi(parsed.id, apiKey)
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
  }

  // Path 2: Server-side pubhtml scrape.
  if (!tabs.length) {
    const htmlUrl = parsed.publishId
      ? `https://docs.google.com/spreadsheets/d/e/${parsed.publishId}/pubhtml`
      : `https://docs.google.com/spreadsheets/d/${parsed.id}/pubhtml`
    try {
      tabs = await tabsViaPubhtml(htmlUrl)
    } catch (err) {
      if (!lastErr) lastErr = err instanceof Error ? err.message : String(err)
    }
  }

  return new Response(
    JSON.stringify({
      tabs,
      source:
        tabs.length === 0
          ? "none"
          : parsed.id && apiKey && !lastErr
            ? "api"
            : "pubhtml",
      error: tabs.length === 0 ? (lastErr ?? "No tabs discovered") : null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})
