import { useState } from "react"
import {
  useAdsCampaignPerformance,
  useMarketingIntegrations,
  useRunAdsSync,
  useUpsertMarketingIntegration,
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
  const upsert = useUpsertMarketingIntegration()
  const runSync = useRunAdsSync()

  const [platform, setPlatform] = useState<AdsPlatform>("google_ads")
  const [accountId, setAccountId] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")

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
            onClick={() => runSync.mutate("all")}
            disabled={runSync.isPending}
          >
            {runSync.isPending ? "Syncing..." : "Run Sync"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  )
}
