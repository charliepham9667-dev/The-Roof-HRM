#!/usr/bin/env node
// Split a large PDF into multiple parts (<= MAX_PART_MB each), then register
// them as assets on a marketing plan so they render on the dashboard's
// Brand Kit & Reference Library.
//
// Usage:
//   node scripts/upload-marketing-kit-split.mjs "/path/file.pdf" ["Plan Title"]

import { createClient } from "@supabase/supabase-js"
import { PDFDocument } from "pdf-lib"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { existsSync, readFileSync } from "node:fs"

const envPath = new URL("../.env", import.meta.url)
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const BUCKET = "marketing-plan-assets"
const MAX_PART_BYTES = 48 * 1024 * 1024 // stay safely under the 50 MB project ceiling

const filePath = process.argv[2]
const planTitle = process.argv[3] || "Master Marketing & Event Plan 2026"
if (!filePath) {
  console.error("Usage: node scripts/upload-marketing-kit-split.mjs <file> [planTitle]")
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

async function buildPart(source, startIdx, endIdxExclusive) {
  const doc = await PDFDocument.create()
  const idxs = Array.from({ length: endIdxExclusive - startIdx }, (_, i) => startIdx + i)
  const copied = await doc.copyPages(source, idxs)
  for (const p of copied) doc.addPage(p)
  return doc.save({ useObjectStreams: true })
}

async function splitPdfByBytes(bytes) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const totalPages = source.getPageCount()
  const avgBytesPerPage = bytes.byteLength / totalPages
  const initialPagesPerPart = Math.max(1, Math.floor((MAX_PART_BYTES * 0.9) / avgBytesPerPage))
  console.log(`source pages: ${totalPages} · avg ${(avgBytesPerPage / 1024 / 1024).toFixed(2)} MB/page · est pages/part ${initialPagesPerPart}`)

  const parts = []
  let pageIndex = 0
  let partNumber = 1

  while (pageIndex < totalPages) {
    let windowSize = Math.min(initialPagesPerPart, totalPages - pageIndex)
    let saved = await buildPart(source, pageIndex, pageIndex + windowSize)
    // Shrink until it fits
    while (saved.byteLength > MAX_PART_BYTES && windowSize > 1) {
      windowSize = Math.max(1, Math.floor(windowSize * 0.75))
      saved = await buildPart(source, pageIndex, pageIndex + windowSize)
    }
    // Try to grow greedily to fill the budget
    while (pageIndex + windowSize < totalPages) {
      const grown = await buildPart(source, pageIndex, pageIndex + windowSize + 1)
      if (grown.byteLength > MAX_PART_BYTES) break
      saved = grown
      windowSize += 1
    }

    parts.push({
      part: partNumber++,
      startPage: pageIndex + 1,
      endPage: pageIndex + windowSize,
      bytes: Buffer.from(saved),
    })
    console.log(`  part ${partNumber - 1}: pages ${pageIndex + 1}-${pageIndex + windowSize} · ${(saved.byteLength / 1024 / 1024).toFixed(1)} MB`)
    pageIndex += windowSize
  }
  return parts
}

async function main() {
  const bytes = await readFile(filePath)
  const origName = basename(filePath)
  const origSizeMB = (bytes.byteLength / 1024 / 1024).toFixed(1)
  console.log(`source file: ${origName} (${origSizeMB} MB)`)

  const { data: ownerProfile } = await admin
    .from("profiles").select("id,full_name,email,role").eq("role", "owner").limit(1).maybeSingle()
  if (!ownerProfile) throw new Error("No owner profile found.")
  console.log(`owner: ${ownerProfile.full_name || ownerProfile.email} (${ownerProfile.id})`)

  let { data: plan } = await admin
    .from("marketing_plans").select("id,title").eq("title", planTitle).limit(1).maybeSingle()
  if (!plan) {
    const { data: created, error } = await admin.from("marketing_plans").insert({
      title: planTitle,
      objective: "Master brand, event and marketing reference kit for The Roof.",
      status: "active",
      owner_id: ownerProfile.id,
      created_by: ownerProfile.id,
      notes:
        "Reference document containing brand identity, marketing strategy, event plan and creative direction. " +
        "Used across the marketing team for alignment on voice, positioning and campaign execution.",
    }).select("id,title").single()
    if (error) throw error
    plan = created
    console.log(`created plan: ${plan.title} (${plan.id})`)
  } else {
    console.log(`plan exists: ${plan.title} (${plan.id})`)
  }

  const parts = await splitPdfByBytes(bytes)
  const totalParts = parts.length
  console.log(`uploading ${totalParts} part(s)…`)
  for (const part of parts) {
    const safeBase = origName.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9.-]/g, "_")
    const partName = totalParts === 1
      ? `${safeBase}.pdf`
      : `${safeBase}__part_${String(part.part).padStart(2, "0")}_of_${String(totalParts).padStart(2, "0")}_pages_${part.startPage}-${part.endPage}.pdf`
    const storagePath = `${plan.id}/${Date.now()}-${partName}`
    const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, part.bytes, {
      contentType: "application/pdf",
      upsert: false,
    })
    if (upErr) throw upErr
    const { error: assetErr } = await admin.from("marketing_plan_assets").insert({
      plan_id: plan.id,
      file_path: storagePath,
      file_name: partName,
      mime_type: "application/pdf",
      size_bytes: part.bytes.byteLength,
      uploaded_by: ownerProfile.id,
    })
    if (assetErr) throw assetErr
    console.log(`  uploaded ${partName}`)
  }

  console.log("done.")
}

main().catch((e) => {
  console.error("failed:", e.message || e)
  process.exit(1)
})
