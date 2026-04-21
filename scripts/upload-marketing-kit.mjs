#!/usr/bin/env node
// One-off uploader: registers the master marketing / event / branding kit into
// `marketing_plans` + `marketing_plan_assets` so it is visible on the
// Marketing Dashboard (Brand Kit & Reference Library section).
//
// Usage:
//   node scripts/upload-marketing-kit.mjs "/path/to/file.pdf" ["Plan Title"]
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env at the repo root.

import { createClient } from "@supabase/supabase-js"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { existsSync, readFileSync } from "node:fs"

const envPath = new URL("../.env", import.meta.url)
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const BUCKET = "marketing-plan-assets"

const filePath = process.argv[2]
const planTitle = process.argv[3] || "Master Marketing & Event Plan 2026"
if (!filePath) {
  console.error("Usage: node scripts/upload-marketing-kit.mjs <file> [planTitle]")
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

function guessMime(name) {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".key")) return "application/vnd.apple.keynote"
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  if (lower.endsWith(".key.zip") || lower.endsWith(".zip")) return "application/zip"
  return "application/octet-stream"
}

async function main() {
  const bytes = await readFile(filePath)
  const fileName = basename(filePath)
  const size = bytes.byteLength
  const mime = guessMime(fileName)
  console.log(`file: ${fileName} (${(size / 1024 / 1024).toFixed(1)} MB, ${mime})`)

  // Pick the first owner profile as the creator/owner.
  const { data: ownerProfile, error: ownerErr } = await admin
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle()
  if (ownerErr) throw ownerErr
  if (!ownerProfile) throw new Error("No owner profile found — cannot register plan.")
  console.log(`owner profile: ${ownerProfile.full_name || ownerProfile.email} (${ownerProfile.id})`)

  // Find or create the plan.
  let { data: plan, error: planSelErr } = await admin
    .from("marketing_plans")
    .select("id,title")
    .eq("title", planTitle)
    .limit(1)
    .maybeSingle()
  if (planSelErr) throw planSelErr
  if (!plan) {
    const { data: created, error: planCreateErr } = await admin
      .from("marketing_plans")
      .insert({
        title: planTitle,
        objective: "Master brand, event and marketing reference kit for The Roof.",
        status: "active",
        owner_id: ownerProfile.id,
        created_by: ownerProfile.id,
        notes:
          "Reference document containing brand identity, marketing strategy, event plan and creative direction. " +
          "Used across the marketing team for alignment on voice, positioning and campaign execution.",
      })
      .select("id,title")
      .single()
    if (planCreateErr) throw planCreateErr
    plan = created
    console.log(`created plan: ${plan.title} (${plan.id})`)
  } else {
    console.log(`existing plan: ${plan.title} (${plan.id})`)
  }

  // Upload into storage.
  const storagePath = `${plan.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (upErr) throw upErr
  console.log(`uploaded to storage: ${BUCKET}/${storagePath}`)

  // Register asset row.
  const { data: asset, error: assetErr } = await admin
    .from("marketing_plan_assets")
    .insert({
      plan_id: plan.id,
      file_path: storagePath,
      file_name: fileName,
      mime_type: mime,
      size_bytes: size,
      uploaded_by: ownerProfile.id,
    })
    .select("id,file_name,file_path")
    .single()
  if (assetErr) throw assetErr
  console.log(`registered asset row: ${asset.id}`)
  console.log("done.")
}

main().catch((e) => {
  console.error("failed:", e.message || e)
  process.exit(1)
})
