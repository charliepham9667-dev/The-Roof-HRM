export type SocialPlatformKey = "instagram" | "tiktok" | "facebook" | "google"

export type SocialPlatformMetrics = {
  followers_total?: number | null
  page_likes_total?: number | null
  reach?: number | null
  engagement_rate?: number | null
  new_followers?: number | null
  new_likes?: number | null
  profile_visits?: number | null
  avg_views?: number | null
  videos_posted?: number | null
  posts?: number | null
  link_clicks?: number | null
  star_rating?: number | null
  total_reviews?: number | null
  new_reviews?: number | null
  unanswered_reviews?: number | null
  searches?: number | null
  direction_requests?: number | null
}

export type SocialMonthlyPayload = Record<SocialPlatformKey, SocialPlatformMetrics>

export type MarketingSocialCsvParseResult = {
  payload: SocialMonthlyPayload
  diagnostics: string[]
}

const EMPTY_PAYLOAD: SocialMonthlyPayload = {
  instagram: {},
  tiktok: {},
  facebook: {},
  google: {},
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim())
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function normalizeHeader(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function parseScaledNumber(raw: string | null | undefined): number | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const cleaned = value.replace(/,/g, "").replace(/\s+/g, "")
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  let num = Number(match[0])
  if (!Number.isFinite(num)) return null
  const suffix = cleaned.slice(match.index! + match[0].length).toLowerCase()
  if (suffix.startsWith("k")) num *= 1000
  if (suffix.startsWith("m")) num *= 1000000
  return Math.round(num)
}

function parsePercent(raw: string | null | undefined): number | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const m = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function findHeaderRow(lines: string[]) {
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cols = parseCsvLine(lines[i]).map(normalizeHeader)
    if (cols.includes("category") && cols.some((c) => c === "reach" || c === "new_followers")) {
      return { header: cols, index: i }
    }
  }
  return null
}

function pick(row: Record<string, string>, aliases: string[]) {
  for (const a of aliases) {
    if (row[a] && String(row[a]).trim() !== "") return String(row[a]).trim()
  }
  return null
}

function resolvePlatform(category: string | null): SocialPlatformKey | null {
  const c = String(category || "").toLowerCase()
  if (c.includes("insta")) return "instagram"
  if (c.includes("tik")) return "tiktok"
  if (c.includes("face")) return "facebook"
  if (c.includes("google")) return "google"
  return null
}

export function parseMarketingSocialCsv(csvText: string): MarketingSocialCsvParseResult {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
  const diagnostics: string[] = []
  if (lines.length < 2) return { payload: EMPTY_PAYLOAD, diagnostics: ["CSV appears empty."] }

  const headerInfo = findHeaderRow(lines)
  if (!headerInfo) {
    return {
      payload: EMPTY_PAYLOAD,
      diagnostics: ["Could not find a header row with Category + Reach/New Followers columns."],
    }
  }

  const payload: SocialMonthlyPayload = {
    instagram: {},
    tiktok: {},
    facebook: {},
    google: {},
  }

  for (let i = headerInfo.index + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headerInfo.header.forEach((h, idx) => {
      row[h] = cols[idx] ?? ""
    })

    const platform = resolvePlatform(pick(row, ["category", "channel", "platform"]))
    if (!platform) continue

    const reach = parseScaledNumber(pick(row, ["reach"]))
    const interactions = parseScaledNumber(pick(row, ["interactions", "engagements"]))
    const engagementRate = parsePercent(pick(row, ["engagement_rate", "engagement"]))
    const linkClicks = parseScaledNumber(pick(row, ["link_clicks", "clicks"]))
    const newFollowers = parseScaledNumber(pick(row, ["new_followers", "new_follower"]))
    const socialPosts = parseScaledNumber(pick(row, ["social_posts", "posts"]))
    const clipsReels = parseScaledNumber(pick(row, ["clip_reels", "clips_reels", "clips", "reels"]))
    const pageVisits = parseScaledNumber(pick(row, ["page_visits", "profile_visits"]))
    const views = parseScaledNumber(pick(row, ["views"]))

    const target = payload[platform]
    if (reach != null) target.reach = reach
    if (linkClicks != null) target.link_clicks = linkClicks
    if (pageVisits != null) target.profile_visits = pageVisits
    if (engagementRate != null) target.engagement_rate = engagementRate
    if (newFollowers != null) {
      if (platform === "facebook") target.new_likes = newFollowers
      else target.new_followers = newFollowers
    }
    if (socialPosts != null) {
      if (platform === "facebook") target.posts = socialPosts
      if (platform === "google") target.posts = socialPosts
    }
    if (clipsReels != null && platform === "tiktok") target.videos_posted = clipsReels
    if (views != null && platform === "tiktok") target.avg_views = views
    if (interactions != null && target.reach && !target.engagement_rate && target.reach > 0) {
      target.engagement_rate = Number(((interactions / target.reach) * 100).toFixed(2))
    }
  }

  diagnostics.push("Parsed rows for Instagram, TikTok and Facebook when present in CSV.")
  diagnostics.push("Google metrics are usually not in this file and may need manual fill.")
  return { payload, diagnostics }
}
