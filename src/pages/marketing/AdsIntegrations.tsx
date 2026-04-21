import { useState } from "react"
import {
  useMarketingSyncRuns,
  useAdsCampaignPerformance,
  useMarketingIntegrations,
  useRunAdsSync,
  useUpsertMarketingIntegration,
  type AdsManualMetricInput,
  type AdsPlatform,
} from "@/hooks/useAdsIntegrations"

const PLATFORM_OPTIONS: Array<{ value: AdsPlatform; label: string }> = [
  { value: "google_ads", label: "Google Ads" },
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
]

export default function AdsIntegrations() {
  const { data: integrations = [] } = useMarketingIntegrations()
  const { data: campaigns = [] } = useAdsCampaignPerformance()
  const { data: runs = [] } = useMarketingSyncRuns()
  const upsert = useUpsertMarketingIntegration()
  const runSync = useRunAdsSync()

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

  const platformAccounts = integrations.filter((x) => x.platform === platform && x.is_active)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-foreground">Ads Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure Google/Facebook/TikTok accounts and sync campaign metrics.</p>
      </div>

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
            <div key={row.id} className="rounded border border-border bg-background px-3 py-2">
              <div className="text-sm font-medium text-foreground">{row.account_name || row.account_id}</div>
              <div className="text-xs text-muted-foreground">{row.platform} · {row.is_active ? "active" : "inactive"}</div>
            </div>
          ))}
          {integrations.length === 0 && <div className="text-sm text-muted-foreground">No integrations configured.</div>}
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest Campaign Metrics</div>
          {campaigns.slice(0, 12).map((c: any) => (
            <div key={c.id} className="rounded border border-border bg-background px-3 py-2">
              <div className="text-sm font-medium text-foreground">{c.campaign_name}</div>
              <div className="text-xs text-muted-foreground">
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
    </div>
  )
}
