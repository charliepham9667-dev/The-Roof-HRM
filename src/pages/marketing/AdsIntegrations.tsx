import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import {
  useMarketingSyncRuns,
  useAdsCampaignPerformance,
  useMarketingIntegrations,
  useRunAdsSync,
  useUpsertMarketingIntegration,
  useDeleteAdsCampaignData,
  type AdsManualMetricInput,
  type AdsPlatform,
} from "@/hooks/useAdsIntegrations"
import {
  useLatestMarketingSocialMonthlyReport,
  useUpsertMarketingSocialMonthlyReport,
  useUploadMarketingSocialReportSource,
} from "@/hooks/useMarketingSocialMonthly"
import {
  parseMarketingSocialCsv,
  type SocialMonthlyPayload,
  type SocialPlatformKey,
} from "@/lib/marketingSocialCsvParser"
import { parseAdsCsv, type CsvParseResult } from "@/lib/adsCsvParser"

const PLATFORM_OPTIONS: Array<{ value: AdsPlatform; label: string }> = [
  { value: "google_ads", label: "Google Ads" },
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
]

const EMPTY_SOCIAL_PAYLOAD: SocialMonthlyPayload = {
  instagram: {},
  tiktok: {},
  facebook: {},
  google: {},
}

const REQUIRED_SOCIAL_FIELDS: Array<{
  key: string
  platform: SocialPlatformKey
  label: string
}> = [
  { key: "instagram.reach", platform: "instagram", label: "Instagram Reach" },
  { key: "instagram.engagement_rate", platform: "instagram", label: "Instagram Engagement %" },
  { key: "instagram.new_followers", platform: "instagram", label: "Instagram New Followers" },
  { key: "instagram.profile_visits", platform: "instagram", label: "Instagram Page/Profile Visits" },
  { key: "instagram.link_clicks", platform: "instagram", label: "Instagram Link Clicks" },
  { key: "facebook.reach", platform: "facebook", label: "Facebook Reach" },
  { key: "facebook.engagement_rate", platform: "facebook", label: "Facebook Engagement %" },
  { key: "facebook.new_likes", platform: "facebook", label: "Facebook New Likes" },
  { key: "facebook.profile_visits", platform: "facebook", label: "Facebook Page Visits" },
  { key: "facebook.link_clicks", platform: "facebook", label: "Facebook Link Clicks" },
  { key: "tiktok.avg_views", platform: "tiktok", label: "TikTok Avg Views" },
  { key: "tiktok.new_followers", platform: "tiktok", label: "TikTok New Followers" },
  { key: "tiktok.profile_visits", platform: "tiktok", label: "TikTok Page Visits" },
  { key: "google.star_rating", platform: "google", label: "Google Star Rating" },
  { key: "google.total_reviews", platform: "google", label: "Google Total Reviews" },
  { key: "google.new_reviews", platform: "google", label: "Google New Reviews" },
  { key: "google.unanswered_reviews", platform: "google", label: "Google Unanswered Reviews" },
  { key: "google.searches", platform: "google", label: "Google Searches" },
  { key: "google.direction_requests", platform: "google", label: "Google Direction Requests" },
]

function readSocialValue(payload: SocialMonthlyPayload, key: string): number | null {
  const [platform, field] = key.split(".")
  const p = payload[platform as SocialPlatformKey] as Record<string, number | null | undefined>
  const value = p?.[field]
  return value == null || !Number.isFinite(value) ? null : Number(value)
}

function setSocialValue(payload: SocialMonthlyPayload, key: string, value: number | null) {
  const [platform, field] = key.split(".")
  const p = platform as SocialPlatformKey
  return {
    ...payload,
    [p]: {
      ...(payload[p] || {}),
      [field]: value,
    },
  }
}

function missingSocialFields(payload: SocialMonthlyPayload) {
  return REQUIRED_SOCIAL_FIELDS.filter((field) => readSocialValue(payload, field.key) == null)
}

export default function AdsIntegrations() {
  const { data: integrations = [] } = useMarketingIntegrations()
  const { data: campaigns = [] } = useAdsCampaignPerformance()
  const { data: runs = [] } = useMarketingSyncRuns()
  const { data: latestSocialReport } = useLatestMarketingSocialMonthlyReport()
  const upsert = useUpsertMarketingIntegration()
  const runSync = useRunAdsSync()
  const deleteAdsData = useDeleteAdsCampaignData()
  const saveSocialReport = useUpsertMarketingSocialMonthlyReport()
  const uploadSocialSource = useUploadMarketingSocialReportSource()

  const [platform, setPlatform] = useState<AdsPlatform>("google_ads")
  const [accountId, setAccountId] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [manualAccountId, setManualAccountId] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [campaignName, setCampaignName] = useState("")
  const [metricDate, setMetricDate] = useState(new Date().toISOString().slice(0, 10))
  const [spend, setSpend] = useState("")
  const [impressions, setImpressions] = useState("")
  const [clicks, setClicks] = useState("")
  const [conversions, setConversions] = useState("")
  const [revenue, setRevenue] = useState("")
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const [csvPlatform, setCsvPlatform] = useState<AdsPlatform>("google_ads")
  const [csvAccountId, setCsvAccountId] = useState("")
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null)
  const [csvFileName, setCsvFileName] = useState<string>("")
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvMessage, setCsvMessage] = useState<string | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [socialReportMonth, setSocialReportMonth] = useState(() => format(new Date(), "yyyy-MM"))
  const [socialSourceFile, setSocialSourceFile] = useState<File | null>(null)
  const [socialSourceFileName, setSocialSourceFileName] = useState<string | null>(null)
  const [socialMessage, setSocialMessage] = useState<string | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)
  const [socialDraft, setSocialDraft] = useState<SocialMonthlyPayload | null>(null)
  const [manualSocialFields, setManualSocialFields] = useState<Record<string, string>>({})

  const platformAccounts = integrations.filter((x) => x.platform === platform && x.is_active)
  const csvPlatformAccounts = useMemo(
    () => integrations.filter((x) => x.platform === csvPlatform && x.is_active),
    [integrations, csvPlatform],
  )
  const missingTokenIntegrations = integrations.filter((x) => x.is_active && !x.has_refresh_token)
  const socialMissing = missingSocialFields(socialDraft || latestSocialReport?.payload || EMPTY_SOCIAL_PAYLOAD)

  const bootstrapManualFields = (payload: SocialMonthlyPayload) => {
    const next: Record<string, string> = {}
    for (const field of REQUIRED_SOCIAL_FIELDS) {
      const value = readSocialValue(payload, field.key)
      next[field.key] = value == null ? "" : String(value)
    }
    setManualSocialFields(next)
  }

  const handleMonthlySocialFile = async (file: File) => {
    setSocialError(null)
    setSocialMessage(null)
    setSocialSourceFile(file)
    setSocialSourceFileName(file.name)
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv")
      if (!isCsv) {
        const cloned: SocialMonthlyPayload = {
          instagram: {},
          tiktok: {},
          facebook: {},
          google: {},
        }
        setSocialDraft(cloned)
        bootstrapManualFields(cloned)
        setSocialMessage(
          `Attached ${file.name}. Please enter this month's numbers from the screenshot, then save.`,
        )
        return
      }

      const text = await file.text()
      const parsed = parseMarketingSocialCsv(text)
      const merged: SocialMonthlyPayload = {
        instagram: { ...(latestSocialReport?.payload.instagram || {}), ...(parsed.payload.instagram || {}) },
        tiktok: { ...(latestSocialReport?.payload.tiktok || {}), ...(parsed.payload.tiktok || {}) },
        facebook: { ...(latestSocialReport?.payload.facebook || {}), ...(parsed.payload.facebook || {}) },
        google: { ...(latestSocialReport?.payload.google || {}), ...(parsed.payload.google || {}) },
      }
      setSocialDraft(merged)
      bootstrapManualFields(merged)
      const missing = missingSocialFields(merged)
      setSocialMessage(
        missing.length > 0
          ? `Uploaded ${file.name}. ${missing.length} value${missing.length === 1 ? "" : "s"} still needed before save.`
          : `Uploaded ${file.name}. Ready to save.`,
      )
    } catch (err: any) {
      setSocialError(err?.message || "Failed to parse monthly file.")
    }
  }

  const handleSaveMonthlySocial = async () => {
    setSocialError(null)
    setSocialMessage(null)
    const base = socialDraft || latestSocialReport?.payload || EMPTY_SOCIAL_PAYLOAD
    let next = { ...base }
    for (const field of REQUIRED_SOCIAL_FIELDS) {
      const raw = String(manualSocialFields[field.key] || "").trim()
      const parsed = raw === "" ? null : Number(raw)
      if (raw !== "" && !Number.isFinite(parsed)) {
        setSocialError(`Invalid number for "${field.label}".`)
        return
      }
      next = setSocialValue(next, field.key, parsed)
    }

    const missing = missingSocialFields(next)
    if (missing.length > 0) {
      setSocialError(`Still missing: ${missing.map((m) => m.label).join(", ")}`)
      return
    }

    try {
      let sourcePath = latestSocialReport?.source_file_path || null
      let sourceMime = latestSocialReport?.source_file_mime_type || null
      let sourceSize = latestSocialReport?.source_file_size_bytes || null
      let sourceName = socialSourceFileName || latestSocialReport?.source_file_name || null
      if (socialSourceFile) {
        const uploaded = await uploadSocialSource.mutateAsync({
          reportMonth: `${socialReportMonth}-01`,
          file: socialSourceFile,
        })
        sourcePath = uploaded.path
        sourceMime = uploaded.mimeType
        sourceSize = uploaded.sizeBytes
        sourceName = uploaded.fileName
      }
      await saveSocialReport.mutateAsync({
        reportMonth: `${socialReportMonth}-01`,
        sourceFileName: sourceName,
        sourceFilePath: sourcePath,
        sourceFileMimeType: sourceMime,
        sourceFileSizeBytes: sourceSize,
        payload: next,
      })
      setSocialMessage("Monthly social report saved.")
      setSocialDraft(null)
      setSocialSourceFile(null)
    } catch (err: any) {
      setSocialError(err?.message || "Failed to save monthly social report.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-[28px]">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure platform connections and sync marketing metrics.</p>
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Social Report Upload</div>
        <p className="text-xs text-muted-foreground">
          Upload monthly source file (screenshot, PDF, or CSV). If data is missing, fill the required fields and save.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={socialReportMonth}
            onChange={(e) => setSocialReportMonth(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.csv,text/csv"
            className="text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) await handleMonthlySocialFile(file)
              e.currentTarget.value = ""
            }}
          />
          <button
            type="button"
            onClick={handleSaveMonthlySocial}
            disabled={saveSocialReport.isPending}
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveSocialReport.isPending ? "Saving..." : "Save monthly report"}
          </button>
          {latestSocialReport?.report_month && (
            <span className="text-[11px] text-muted-foreground">
              Last saved: {format(new Date(latestSocialReport.report_month), "MMM yyyy")}
            </span>
          )}
        </div>
        {socialSourceFileName && (
          <div className="text-xs text-muted-foreground">
            Source file: <span className="text-foreground">{socialSourceFileName}</span>
          </div>
        )}
        {socialMessage && <div className="text-xs text-success">{socialMessage}</div>}
        {socialError && <div className="text-xs text-destructive">{socialError}</div>}
        {socialMissing.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground">Missing required numbers ({socialMissing.length})</div>
            <div className="grid gap-2 md:grid-cols-3">
              {REQUIRED_SOCIAL_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{field.label}</div>
                  <input
                    value={manualSocialFields[field.key] ?? ""}
                    onChange={(e) => setManualSocialFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    inputMode="decimal"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {missingTokenIntegrations.length > 0 && (
        <div className="rounded-card border border-warning/40 bg-warning/10 p-4 text-sm space-y-2">
          <div className="font-semibold text-warning">
            {missingTokenIntegrations.length} integration{missingTokenIntegrations.length === 1 ? "" : "s"} cannot sync yet — missing refresh token
          </div>
          <div className="text-warning/90 text-xs space-y-1">
            <p>
              Saving an integration records the account, but the <span className="font-mono">Run Sync</span> button
              needs a <strong>refresh token</strong> to call the provider API on your behalf. Without it we cannot
              pull campaign spend/clicks/impressions and nothing will reach the Marketing Dashboard.
            </p>
            <p>
              To generate a Google Ads refresh token in 2 minutes, open{" "}
              <a
                href="https://developers.google.com/oauthplayground/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                OAuth Playground
              </a>
              , click the gear icon, tick <em>Use your own OAuth credentials</em>, paste your OAuth client ID/secret,
              then on the left select the scope <span className="font-mono">https://www.googleapis.com/auth/adwords</span>.
              Authorize, exchange the code for tokens, copy the <strong>Refresh token</strong>, paste it below, and
              click <span className="font-mono">Save Integration</span>. Same flow applies to Meta (scope{" "}
              <span className="font-mono">ads_read</span>) and TikTok (scope <span className="font-mono">ad.read</span>).
            </p>
          </div>
        </div>
      )}

      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Connect Account</div>
        <div className="grid gap-2 md:grid-cols-3">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as AdsPlatform)} className="rounded border border-border bg-background px-3 py-2 text-sm">
            {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account ID" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account Name" className="rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Access token" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} placeholder="Refresh token" className="rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={async () => {
              await upsert.mutateAsync({
                platform,
                account_id: accountId.trim(),
                account_name: accountName.trim() || null,
                access_token: accessToken.trim() || null,
                refresh_token: refreshToken.trim() || null,
              })
              setAccountId("")
              setAccountName("")
              setAccessToken("")
              setRefreshToken("")
            }}
            disabled={!accountId.trim() || upsert.isPending}
          >
            {upsert.isPending ? "Saving..." : "Save Integration"}
          </button>
          <button
            className="rounded border border-border px-3 py-2 text-sm"
            onClick={async () => {
              setSyncMessage(null)
              try {
                const res = await runSync.mutateAsync({ platform: "all" })
                setSyncMessage(
                  `Sync run ${res?.run_id || "created"} completed. Upserted ${Number(res?.rows_upserted || 0)} rows.`,
                )
              } catch (error: any) {
                setSyncMessage(error?.message || "Failed to run sync.")
              }
            }}
            disabled={runSync.isPending}
          >
            {runSync.isPending ? "Syncing..." : "Run Sync"}
          </button>
        </div>
        {syncMessage ? <div className="text-xs text-muted-foreground">{syncMessage}</div> : null}
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Upload Campaign CSV (Recommended)
          </div>
          <div className="text-[10px] text-muted-foreground">
            Export → Drop → Dashboard lights up
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Export a campaign report from Google Ads / Meta Ads Manager / TikTok Ads Manager and drop the CSV here.
          We auto-detect the columns, normalise spend/clicks/impressions, and push rows into the Marketing Dashboard.
          No OAuth, no approvals required. See the{" "}
          <a
            href="#csv-export-guide"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById("csv-export-guide")?.scrollIntoView({ behavior: "smooth" })
            }}
            className="underline"
          >
            export guide
          </a>{" "}
          below for exact reports to pull from each platform.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={csvPlatform}
            onChange={(e) => {
              setCsvPlatform(e.target.value as AdsPlatform)
              setCsvAccountId("")
              setCsvResult(null)
              setCsvError(null)
              setCsvMessage(null)
            }}
            className="rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={csvAccountId}
            onChange={(e) => setCsvAccountId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select connected account</option>
            {csvPlatformAccounts.map((a) => (
              <option key={a.id} value={a.account_id}>
                {a.account_name || a.account_id}
              </option>
            ))}
          </select>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
            onChange={async (e) => {
              setCsvError(null)
              setCsvMessage(null)
              setCsvResult(null)
              const file = e.target.files?.[0]
              if (!file) return
              if (!csvAccountId) {
                setCsvError("Select a connected account first.")
                e.target.value = ""
                return
              }
              try {
                const text = await file.text()
                const result = parseAdsCsv(text, csvPlatform, csvAccountId)
                setCsvResult(result)
                setCsvFileName(file.name)
              } catch (err) {
                setCsvError(err instanceof Error ? err.message : "Failed to read file.")
              }
            }}
          />
        </div>
        {csvPlatformAccounts.length === 0 && (
          <div className="text-xs text-warning">
            No active {PLATFORM_OPTIONS.find((p) => p.value === csvPlatform)?.label} account yet. Add one above first
            (Account ID + Account Name is enough for CSV uploads — no token required).
          </div>
        )}
        {csvError && <div className="text-xs text-destructive">{csvError}</div>}
        {csvResult && (
          <div className="rounded border border-border bg-background p-3 text-xs space-y-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 truncate font-semibold text-foreground">
                Parsed {csvResult.rows.length} rows from {csvFileName || "CSV"}
              </div>
              <div className="text-muted-foreground sm:shrink-0">
                {csvResult.totalRowsParsed} lines read · {csvResult.skipped.length} skipped
              </div>
            </div>
            {csvResult.diagnostic && (
              <div
                className={
                  csvResult.rows.length === 0
                    ? "rounded border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning whitespace-pre-wrap"
                    : "rounded border border-border bg-secondary/30 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap"
                }
              >
                {csvResult.diagnostic}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[11px]">
              {Object.entries(csvResult.columnsDetected).map(([field, header]) => (
                <div
                  key={field}
                  className={
                    header
                      ? "rounded border border-success/20 bg-success/5 px-2 py-1"
                      : "rounded border border-warning/30 bg-warning/10 px-2 py-1"
                  }
                >
                  <div className="uppercase tracking-wider text-muted-foreground">{field}</div>
                  <div className="truncate text-foreground">{header ?? "not found"}</div>
                </div>
              ))}
            </div>
            {csvResult.skipped.length > 0 && (
              <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer">Show {csvResult.skipped.length} skipped rows</summary>
                <ul className="mt-1 ml-4 list-disc">
                  {csvResult.skipped.slice(0, 20).map((s, idx) => (
                    <li key={idx}>
                      Line {s.line}: {s.reason}
                    </li>
                  ))}
                  {csvResult.skipped.length > 20 && <li>…and {csvResult.skipped.length - 20} more</li>}
                </ul>
              </details>
            )}
            <div className="flex gap-2 pt-1">
              <button
                className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
                disabled={csvImporting || csvResult.rows.length === 0}
                onClick={async () => {
                  setCsvImporting(true)
                  setCsvError(null)
                  setCsvMessage(null)
                  try {
                    const BATCH = 200
                    let totalUpserted = 0
                    for (let i = 0; i < csvResult.rows.length; i += BATCH) {
                      const chunk = csvResult.rows.slice(i, i + BATCH)
                      const res = await runSync.mutateAsync({ platform: csvPlatform, manualRows: chunk })
                      totalUpserted += Number(res?.rows_upserted || 0)
                    }
                    setCsvMessage(
                      `Imported ${totalUpserted} of ${csvResult.rows.length} rows into ads_campaigns_daily. The Marketing Dashboard will refresh within a few seconds.`,
                    )
                    setCsvResult(null)
                    setCsvFileName("")
                    if (csvInputRef.current) csvInputRef.current.value = ""
                  } catch (err) {
                    setCsvError(err instanceof Error ? err.message : "Import failed.")
                  } finally {
                    setCsvImporting(false)
                  }
                }}
              >
                {csvImporting
                  ? `Importing ${csvResult.rows.length} rows…`
                  : `Import ${csvResult.rows.length} rows`}
              </button>
              <button
                className="rounded border border-border px-3 py-2 text-sm"
                onClick={() => {
                  setCsvResult(null)
                  setCsvFileName("")
                  setCsvMessage(null)
                  setCsvError(null)
                  if (csvInputRef.current) csvInputRef.current.value = ""
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {csvMessage && <div className="text-xs text-success">{csvMessage}</div>}
        <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
          <span className="text-[11px] text-muted-foreground flex-1">Uploaded wrong data? Clear all rows for a platform and re-upload the correct CSV.</span>
          <select
            id="clear-platform-select"
            defaultValue="google_ads"
            className="rounded border border-border bg-background px-2 py-1.5 text-xs"
          >
            {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button
            className="rounded border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-40"
            disabled={deleteAdsData.isPending}
            onClick={async () => {
              const sel = (document.getElementById("clear-platform-select") as HTMLSelectElement).value as AdsPlatform
              if (!window.confirm(`Delete ALL ${PLATFORM_OPTIONS.find(p => p.value === sel)?.label} campaign data? This cannot be undone.`)) return
              await deleteAdsData.mutateAsync(sel)
            }}
          >
            {deleteAdsData.isPending ? "Clearing…" : "Clear data"}
          </button>
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Manual Metrics Ingestion</div>
        <p className="text-xs text-muted-foreground">
          Use this to ingest campaign rows now while OAuth/provider adapters are being finalized.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as AdsPlatform)} className="rounded border border-border bg-background px-3 py-2 text-sm">
            {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={manualAccountId} onChange={(e) => setManualAccountId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select connected account</option>
            {platformAccounts.map((a) => (
              <option key={a.id} value={a.account_id}>{a.account_name || a.account_id}</option>
            ))}
          </select>
          <input type="date" value={metricDate} onChange={(e) => setMetricDate(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Campaign ID" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign Name" className="rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <input value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="Spend" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={impressions} onChange={(e) => setImpressions(e.target.value)} placeholder="Impressions" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="Clicks" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={conversions} onChange={(e) => setConversions(e.target.value)} placeholder="Conversions" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Revenue" className="rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            disabled={!manualAccountId || !campaignId.trim() || !campaignName.trim() || !metricDate || runSync.isPending}
            onClick={async () => {
              setSyncMessage(null)
              const manualRow: AdsManualMetricInput = {
                platform,
                account_id: manualAccountId,
                campaign_id: campaignId.trim(),
                campaign_name: campaignName.trim(),
                metric_date: metricDate,
                spend: Number(spend || 0),
                impressions: Number(impressions || 0),
                clicks: Number(clicks || 0),
                conversions: Number(conversions || 0),
                revenue: Number(revenue || 0),
                raw_payload: { source: "ads_integrations_manual_form" },
              }
              try {
                const res = await runSync.mutateAsync({ platform, manualRows: [manualRow] })
                setSyncMessage(
                  `Manual ingest complete. Run ${res?.run_id || "created"} upserted ${Number(res?.rows_upserted || 0)} row(s).`,
                )
                setCampaignId("")
                setCampaignName("")
                setSpend("")
                setImpressions("")
                setClicks("")
                setConversions("")
                setRevenue("")
              } catch (error: any) {
                setSyncMessage(error?.message || "Manual ingest failed.")
              }
            }}
          >
            {runSync.isPending ? "Syncing..." : "Sync One Manual Row"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Connected Integrations</div>
          {integrations.map((row) => (
            <div key={row.id} className="rounded border border-border bg-background px-3 py-2 min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{row.account_name || row.account_id}</div>
              <div className="truncate text-xs text-muted-foreground">
                {row.platform} · {row.is_active ? "active" : "inactive"}
              </div>
              {!row.has_refresh_token ? (
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  CSV upload ready · API sync disabled (no refresh token)
                </div>
              ) : (
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-success">
                  CSV upload ready · API sync ready
                </div>
              )}
            </div>
          ))}
          {integrations.length === 0 && <div className="text-sm text-muted-foreground">No integrations configured.</div>}
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest Campaign Metrics</div>
          {campaigns.slice(0, 12).map((c: any) => (
            <div key={c.id} className="rounded border border-border bg-background px-3 py-2 min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{c.campaign_name}</div>
              <div className="text-xs text-muted-foreground break-words">
                {c.platform} · {c.metric_date} · Spend {Number(c.spend || 0).toLocaleString("en-US")} · Clicks {Number(c.clicks || 0)}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <div className="text-sm text-muted-foreground">No campaign metrics yet. Run sync after connecting accounts.</div>}
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent Sync Runs</div>
          {runs.map((r) => (
            <div key={r.id} className="rounded border border-border bg-background px-3 py-2">
              <div className="text-sm font-medium text-foreground">{r.platform} · {r.status}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.started_at).toLocaleString()} · upserted {Number(r.rows_upserted || 0)}
              </div>
              {r.error_message ? <div className="text-xs text-destructive mt-1">{r.error_message}</div> : null}
            </div>
          ))}
          {runs.length === 0 && <div className="text-sm text-muted-foreground">No sync runs yet.</div>}
        </div>
      </div>

      <div
        id="csv-export-guide"
        className="rounded-card border border-border bg-card p-4 shadow-card space-y-4 text-sm"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">CSV Export Guide</div>
          <p className="mt-1 text-muted-foreground">
            Each platform lets you export a campaign report in 3 clicks. The parser auto-detects columns so you don't
            need to rename anything.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-semibold text-foreground">Google Ads</div>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-muted-foreground">
              <li>Open ads.google.com → Reports → "Predefined reports" → "Campaign".</li>
              <li>Set date range to "Last 30 days" (or whatever you want).</li>
              <li>
                Make sure these columns are shown: <em>Campaign ID, Campaign, Day, Impressions, Clicks, Cost, Conversions, Conv. value.</em>
              </li>
              <li>Click the Download icon → CSV. Drop that file above.</li>
            </ol>
          </div>

          <div className="rounded border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-semibold text-foreground">Meta Ads (Facebook / Instagram)</div>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-muted-foreground">
              <li>Open Ads Manager → Campaigns tab.</li>
              <li>Click "Columns: Performance" → "Customize columns" and include: Campaign ID, Campaign name, Amount spent, Impressions, Link clicks, Results.</li>
              <li>Set the breakdown: Time → "Day".</li>
              <li>Click "Reports" → "Export table data" → CSV. Drop that file above.</li>
            </ol>
          </div>

          <div className="rounded border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-semibold text-foreground">TikTok Ads</div>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-muted-foreground">
              <li>Open ads.tiktok.com → Campaign tab.</li>
              <li>Click "Custom report" → group by Campaign, breakdown "By Day".</li>
              <li>Include columns: Campaign ID, Campaign name, By Day, Cost, Impressions, Clicks, Total conversion.</li>
              <li>Export → CSV. Drop that file above.</li>
            </ol>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          The importer dedupes on <span className="font-mono">(platform, account_id, campaign_id, metric_date)</span>,
          so uploading the same CSV twice is safe — numbers just get refreshed.
        </p>
      </div>
    </div>
  )
}
