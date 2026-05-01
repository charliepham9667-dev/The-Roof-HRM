import { useMemo, useState } from "react"
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  computeOperationsMetrics,
  filterRowsByScope,
  useOperationsRequestMetrics,
  type RequestReviewStatus,
  type RequestScope,
  type TabDiscoveryReport,
  type TabDiscoverySource,
} from "@/hooks/useOperationsRequestMetrics"
import type { OperationsSheetKind } from "@/hooks/useOperationsSheetLinks"
import { cn } from "@/lib/utils"

const STATUS_ORDER: RequestReviewStatus[] = ["pending", "approved", "cancelled", "declined"]
const STATUS_LABEL: Record<RequestReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  cancelled: "Cancelled",
  declined: "Declined",
}

const STATUS_VARIANT: Record<RequestReviewStatus, "warning" | "positive" | "neutral" | "danger"> = {
  pending: "warning",
  approved: "positive",
  cancelled: "neutral",
  declined: "danger",
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`
}

type Props = {
  kind: Extract<OperationsSheetKind, "purchase_request" | "payment_request">
}

export function RequestOverviewPanel({ kind }: Props) {
  const { parsed, isLoading, isError, error, refetch, link } = useOperationsRequestMetrics(kind)

  const [scope, setScope] = useState<RequestScope>("both")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<Record<RequestReviewStatus, boolean>>({
    pending: true,
    approved: true,
    cancelled: true,
    declined: true,
  })

  const statusesSelected = useMemo(
    () => STATUS_ORDER.filter((s) => statusFilter[s]),
    [statusFilter],
  )

  const filteredRows = useMemo(() => {
    const rowsByScope = filterRowsByScope(parsed.rows, scope, parsed.monthStartIso)
    return rowsByScope.filter((row) => {
      if (!statusFilter[row.status]) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        row.supplier.toLowerCase().includes(q) ||
        row.requester.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        (row.documentId || "").toLowerCase().includes(q)
      )
    })
  }, [parsed.rows, parsed.monthStartIso, scope, statusFilter, search])

  const metricsFiltered = useMemo(() => computeOperationsMetrics(filteredRows), [filteredRows])
  const metricsPast = useMemo(() => computeOperationsMetrics(
    parsed.pastRows.filter((row) => statusFilter[row.status]),
  ), [parsed.pastRows, statusFilter])
  const metricsMtd = useMemo(() => computeOperationsMetrics(
    parsed.mtdRows.filter((row) => statusFilter[row.status]),
  ), [parsed.mtdRows, statusFilter])

  const unknownStatusItems = Object.entries(parsed.quality.unknownStatuses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const title = kind === "purchase_request" ? "Purchase Request Overview" : "Payment Request Overview"

  const hasMissingCsv = !!link && !link.csv_export_url

  return (
    <div className="rounded-card border border-border bg-card shadow-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            COO view: Past (all-time before this month) vs current MTD, with status, category, supplier, and requester concentration.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh metrics
        </Button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Status contract for reporting: <strong>pending</strong>, <strong>approved</strong>, <strong>cancelled</strong>, <strong>declined</strong>.
      </div>

      {parsed.tabs.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-foreground">
              Tabs combined: {parsed.tabs.length}
            </div>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {discoverySourceLabel(parsed.discovery.source)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parsed.tabs.map((tab, i) => (
              <span
                key={`${tab.gid ?? "primary"}-${i}`}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5"
                title={tab.usedTemplateFallback ? "Parsed as form template" : "Parsed as table"}
              >
                <span className="text-foreground">{tab.tabName || `gid ${tab.gid ?? "?"}`}</span>
                <span className="tabular-nums">{tab.rowsParsed}</span>
              </span>
            ))}
          </div>
          {parsed.discovery.source === "primary_only" && (
            <DiscoveryHelp discovery={parsed.discovery} />
          )}
        </div>
      )}

      {!link ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          Connect a sheet link first to compute KPI summaries.
        </div>
      ) : hasMissingCsv ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-3 text-xs text-warning">
          This sheet link does not expose `csv_export_url`. Use a published Google Sheets link so metrics can be calculated.
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-xs text-destructive">
          Failed to load request metrics: {error?.message || "Unknown error"}
        </div>
      ) : isLoading ? (
        <div className="text-xs text-muted-foreground py-4">Loading metrics...</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded border border-border bg-secondary/40 p-1">
              {(["both", "past", "mtd"] as RequestScope[]).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setScope(candidate)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    scope === candidate
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {candidate === "both" ? "Both" : candidate === "past" ? "Past" : "MTD"}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier, requester, category, doc ID"
              className="h-8 min-w-[240px] flex-1 rounded border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter((prev) => ({ ...prev, [status]: !prev[status] }))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  statusFilter[status]
                    ? "border-foreground/30 bg-foreground/10 text-foreground"
                    : "border-border bg-transparent text-muted-foreground",
                )}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStatusFilter({ pending: true, approved: true, cancelled: true, declined: true })}
              className="text-[11px] text-primary hover:underline ml-1"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard label="Past Total" value={formatVnd(metricsPast.totalAmount)} sub={`${metricsPast.totalCount} requests`} />
            <MetricCard label="Current MTD Total" value={formatVnd(metricsMtd.totalAmount)} sub={`${metricsMtd.totalCount} requests`} accent="brand" />
            <MetricCard
              label="Active Filter Result"
              value={formatVnd(metricsFiltered.totalAmount)}
              sub={`${metricsFiltered.totalCount} requests · ${scope.toUpperCase()}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STATUS_ORDER.map((status) => {
              const m = metricsFiltered.byStatus[status]
              return (
                <div key={status} className="rounded border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    <span className="text-[11px] text-muted-foreground">{m.count}</span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-foreground tabular-nums">{formatVnd(m.amount)}</div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <BreakdownCard title="Top Categories" rows={metricsFiltered.topCategories} />
            <BreakdownCard title="Top Suppliers" rows={metricsFiltered.topSuppliers} />
            <BreakdownCard title="Top Requesters" rows={metricsFiltered.topRequesters} />
          </div>

          {(parsed.quality.invalidRows > 0 || unknownStatusItems.length > 0) && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Data quality notices
              </div>
              {parsed.quality.invalidRows > 0 && (
                <div>{parsed.quality.invalidRows} row(s) were skipped due to invalid date, amount, or status format.</div>
              )}
              {unknownStatusItems.length > 0 && (
                <div>
                  Unknown statuses found:
                  {" "}
                  {unknownStatusItems.map(([label, count]) => `${label} (${count})`).join(", ")}
                </div>
              )}
            </div>
          )}

          {!statusesSelected.length && (
            <div className="text-xs text-muted-foreground">
              No statuses selected. Turn on at least one status to view metrics.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: "brand"
}) {
  return (
    <div className={cn(
      "rounded-md border px-3 py-2.5",
      accent === "brand" ? "border-primary/30 bg-primary/5" : "border-border bg-background",
    )}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ key: string; amount: number; count: number }>
}) {
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">No data</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.slice(0, 6).map((row) => (
            <div key={row.key} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="truncate text-foreground">{row.key}</div>
                <div className="text-[11px] text-muted-foreground">{row.count} request(s)</div>
              </div>
              <div className="font-medium tabular-nums text-foreground whitespace-nowrap">{formatVnd(row.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function discoverySourceLabel(source: TabDiscoverySource): string {
  switch (source) {
    case "client_api":
      return "Sheets API (browser)"
    case "edge_api":
      return "Sheets API (edge fn)"
    case "edge_pubhtml":
      return "/pubhtml scrape"
    case "primary_only":
    default:
      return "Primary tab only"
  }
}

function DiscoveryHelp({ discovery }: { discovery: TabDiscoveryReport }) {
  const reasons: string[] = []
  if (!discovery.hasClientApiKey) {
    reasons.push("`VITE_GOOGLE_API_KEY` is not set in your build env")
  }
  if (discovery.triedClientApi && discovery.errorMessage?.startsWith("Client API")) {
    reasons.push(discovery.errorMessage)
  }
  if (discovery.edgeFunctionMissing) {
    reasons.push("`list-sheet-tabs` Edge Function returned 404 (not deployed)")
  } else if (
    discovery.triedEdgeFunction &&
    discovery.errorMessage?.startsWith("Edge Function")
  ) {
    reasons.push(discovery.errorMessage)
  }

  return (
    <div className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-3 w-3" />
        Only the primary tab was summarised — multiple tabs in this sheet are
        being ignored.
      </div>
      {reasons.length > 0 && (
        <ul className="list-disc pl-4 space-y-0.5">
          {reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
      <div className="pt-1 border-t border-amber-200/60 space-y-1">
        <div className="font-medium">Pick one to enable multi-tab roll-up:</div>
        <div>
          <span className="font-semibold">A. Browser-side (no deploy):</span>
          {" "}set <code className="rounded bg-amber-100 px-1">VITE_GOOGLE_API_KEY</code>
          {" "}in <code className="rounded bg-amber-100 px-1">.env</code> /
          {" "}Vercel env, restrict it to your domain in GCP, then redeploy.
        </div>
        <div>
          <span className="font-semibold">B. Server-side:</span> deploy the
          edge function:
        </div>
        <pre className="rounded bg-amber-100/80 px-2 py-1 text-[10.5px] leading-snug overflow-x-auto">{`supabase functions deploy list-sheet-tabs
supabase secrets set GOOGLE_API_KEY=<your_key>`}</pre>
        <div>
          The sheet must also be shared as <em>"Anyone with the link can
          view"</em> for either path to work.
        </div>
      </div>
    </div>
  )
}

export default RequestOverviewPanel

