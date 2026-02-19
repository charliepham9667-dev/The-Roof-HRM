// Supabase Edge Function: employee-documents-drive
// Lists/uploads/deletes employee documents stored in Google Drive.
//
// Auth:
// - Caller must be authenticated.
// - Caller must be owner/manager (checked via `profiles.role`).
//
// Google auth:
// - Uses OAuth refresh token stored in `app_settings.key = google_drive_refresh_token`.
//
// Drive folder structure:
// - Root folder (created on first use):
//   "The Roof HRM - Employee Documents"
// - Employee folder: "<employeeId>"
// - Category folders:
//   - HR Documents
//   - Medical Documents
//   - Certifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

type Category = "hr" | "medical" | "certification"
type Action = "list" | "upload" | "delete"

function categoryFolderName(category: Category): string {
  switch (category) {
    case "hr":
      return "HR Documents"
    case "medical":
      return "Medical Documents"
    case "certification":
      return "Certifications"
  }
}

function escapeDriveQueryValue(value: string): string {
  // Drive query uses single quotes; escape them.
  return value.replace(/'/g, "\\'")
}

async function refreshDriveAccessToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const { data: tokenData } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "google_drive_refresh_token")
    .single()

  if (!tokenData?.value) {
    throw new Error("Google Drive is not connected. Please authorize Google Drive first.")
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.value,
      grant_type: "refresh_token",
    }),
  })

  const tokens = await response.json()
  if (tokens.error) {
    throw new Error(`Token refresh error: ${tokens.error_description || tokens.error}`)
  }

  await supabaseAdmin.from("app_settings").upsert({
    key: "google_drive_access_token",
    value: tokens.access_token,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" })

  return tokens.access_token
}

async function driveListFiles(accessToken: string, q: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files")
  url.searchParams.set("q", q)
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,webContentLink,size,iconLink),nextPageToken",
  )
  url.searchParams.set("pageSize", "200")
  url.searchParams.set("supportsAllDrives", "true")
  url.searchParams.set("includeItemsFromAllDrives", "true")

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Drive list error: ${JSON.stringify(json)}`)
  }
  return json as { files?: any[] }
}

async function driveCreateFolder(accessToken: string, name: string, parentId: string | null) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Drive create folder error: ${JSON.stringify(json)}`)
  return json as { id: string; name: string }
}

async function ensureFolder(accessToken: string, name: string, parentId: string | null): Promise<string> {
  const q = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    `name = '${escapeDriveQueryValue(name)}'`,
    ...(parentId ? [`'${parentId}' in parents`] : []),
  ].join(" and ")

  const found = await driveListFiles(accessToken, q)
  const first = (found.files || [])[0]
  if (first?.id) return String(first.id)

  const created = await driveCreateFolder(accessToken, name, parentId)
  return created.id
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function driveUploadMultipart(accessToken: string, input: {
  name: string
  mimeType: string
  parentId: string
  contentBase64: string
}) {
  const boundary = `roofhrm_${crypto.randomUUID()}`
  const meta = {
    name: input.name,
    parents: [input.parentId],
  }

  const fileBytes = decodeBase64ToBytes(input.contentBase64)
  const enc = new TextEncoder()
  const part1 =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(meta)}\r\n`
  const part2Header =
    `--${boundary}\r\n` +
    `Content-Type: ${input.mimeType}\r\n\r\n`
  const closing = `\r\n--${boundary}--\r\n`

  const bodyBytes = new Uint8Array(
    enc.encode(part1).length +
      enc.encode(part2Header).length +
      fileBytes.length +
      enc.encode(closing).length,
  )

  let offset = 0
  bodyBytes.set(enc.encode(part1), offset)
  offset += enc.encode(part1).length
  bodyBytes.set(enc.encode(part2Header), offset)
  offset += enc.encode(part2Header).length
  bodyBytes.set(fileBytes, offset)
  offset += fileBytes.length
  bodyBytes.set(enc.encode(closing), offset)

  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true"
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: bodyBytes,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Drive upload error: ${JSON.stringify(json)}`)
  return json as { id: string }
}

async function driveGetFile(accessToken: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`)
  url.searchParams.set(
    "fields",
    "id,name,mimeType,createdTime,modifiedTime,webViewLink,webContentLink,size,iconLink",
  )
  url.searchParams.set("supportsAllDrives", "true")
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Drive get file error: ${JSON.stringify(json)}`)
  return json
}

async function driveTrashFile(accessToken: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`)
  url.searchParams.set("supportsAllDrives", "true")
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trashed: true }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Drive delete error: ${JSON.stringify(json)}`)
  return json
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server misconfigured (missing Supabase env)." }, 500)
    }
    if (!clientId || !clientSecret) {
      return json({ error: "Server misconfigured (missing Google OAuth env)." }, 500)
    }

    const authHeader = req.headers.get("Authorization") || ""
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single()

    if (!callerProfile || !["owner", "manager"].includes(String(callerProfile.role))) {
      return json({ error: "Forbidden" }, 403)
    }

    const body = (await req.json()) as {
      action: Action
      employeeId: string
      category: Category
      fileId?: string
      fileName?: string
      mimeType?: string
      contentBase64?: string
    }

    if (!body?.employeeId || !body?.category || !body?.action) {
      return json({ error: "Missing required fields (action, employeeId, category)." }, 400)
    }

    const accessToken = await refreshDriveAccessToken(supabaseAdmin, clientId, clientSecret)

    // Root folder id: env override → app_settings → create on first use
    const envRoot = Deno.env.get("GOOGLE_DRIVE_EMPLOYEE_DOCS_ROOT_FOLDER_ID") || null
    let rootFolderId = envRoot
    if (!rootFolderId) {
      const { data: rootSetting } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "google_drive_employee_docs_root_folder_id")
        .maybeSingle()
      rootFolderId = rootSetting?.value || null
    }
    if (!rootFolderId) {
      rootFolderId = await ensureFolder(accessToken, "The Roof HRM - Employee Documents", null)
      await supabaseAdmin.from("app_settings").upsert({
        key: "google_drive_employee_docs_root_folder_id",
        value: rootFolderId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" })
    }

    const employeeFolderId = await ensureFolder(accessToken, body.employeeId, rootFolderId)
    const categoryFolderId = await ensureFolder(accessToken, categoryFolderName(body.category), employeeFolderId)

    if (body.action === "list") {
      const q = [
        `'${categoryFolderId}' in parents`,
        "trashed = false",
        "mimeType != 'application/vnd.google-apps.folder'",
      ].join(" and ")
      const result = await driveListFiles(accessToken, q)
      const files = (result.files || []).map((f) => ({
        id: String(f.id),
        name: String(f.name || ""),
        mimeType: String(f.mimeType || ""),
        createdTime: String(f.createdTime || ""),
        modifiedTime: String(f.modifiedTime || ""),
        webViewLink: String(f.webViewLink || ""),
        webContentLink: String(f.webContentLink || ""),
        size: f.size ? Number(f.size) : null,
        iconLink: String(f.iconLink || ""),
      }))
      return json({ success: true, files })
    }

    if (body.action === "upload") {
      const fileName = String(body.fileName || "").trim()
      const mimeType = String(body.mimeType || "").trim() || "application/octet-stream"
      const contentBase64 = String(body.contentBase64 || "")
      if (!fileName || !contentBase64) return json({ error: "Missing fileName or contentBase64." }, 400)

      // Soft limit to reduce Edge payload risk (base64 overhead ~33%)
      if (contentBase64.length > 10_000_000) {
        return json({ error: "File too large for this upload method. Use smaller files for now." }, 413)
      }

      const uploaded = await driveUploadMultipart(accessToken, {
        name: fileName,
        mimeType,
        parentId: categoryFolderId,
        contentBase64,
      })
      const meta = await driveGetFile(accessToken, uploaded.id)
      return json({ success: true, file: meta })
    }

    if (body.action === "delete") {
      const fileId = String(body.fileId || "").trim()
      if (!fileId) return json({ error: "Missing fileId." }, 400)
      await driveTrashFile(accessToken, fileId)
      return json({ success: true })
    }

    return json({ error: "Unsupported action" }, 400)
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 400)
  }
})

