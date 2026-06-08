import { cn } from "@/lib/utils"
import { useTableCapacity } from "@/hooks/useTableCapacity"
import {
  GREEN_TABLES_PER_SLOT,
  MAX_TABLES_PER_SLOT,
  SEAVIEW_CAP_PER_SLOT,
  SOFA_CAP_PER_SLOT,
  BAR_CAP_PER_SLOT,
  VENUE_CAPACITY,
  type SlotAllocation,
  type DayRecommendation,
} from "@/lib/capacityModel"
import { Loader2, Waves, Armchair, Wine, Sparkles, CheckCircle2, AlertTriangle, Ban } from "lucide-react"

// ─── Day recommendation banner ─────────────────────────────────────────────

const REC_STYLE = {
  green: { wrap: "border-emerald-200 bg-emerald-50", icon: "text-emerald-600", head: "text-emerald-800", Icon: CheckCircle2 },
  amber: { wrap: "border-amber-200 bg-amber-50",     icon: "text-amber-600",   head: "text-amber-800",   Icon: AlertTriangle },
  red:   { wrap: "border-red-200 bg-red-50",         icon: "text-red-600",     head: "text-red-800",     Icon: Ban },
} as const

function RecommendationBanner({ rec }: { rec: DayRecommendation }) {
  const s = REC_STYLE[rec.tone]
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm", s.wrap)}>
      <div className="flex items-center gap-1.5 shrink-0">
        <Sparkles className={cn("h-4 w-4", s.icon)} />
        <s.Icon className={cn("h-5 w-5", s.icon)} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommendation</span>
        </div>
        <p className={cn("text-[15px] font-bold leading-snug", s.head)}>{rec.headline}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{rec.detail}</p>
      </div>
    </div>
  )
}

// ─── Category pill (seaview / sofa / bar) ──────────────────────────────────

function CatPill({
  icon, label, reserved, cap, tone,
}: {
  icon: React.ReactNode; label: string; reserved: number; cap: number
  tone: "ocean" | "violet" | "amber"
}) {
  const full = reserved >= cap
  const palette = {
    ocean:  { base: "border-sky-200 bg-sky-50 text-sky-700",       fill: "bg-sky-500" },
    violet: { base: "border-violet-200 bg-violet-50 text-violet-700", fill: "bg-violet-500" },
    amber:  { base: "border-amber-200 bg-amber-50 text-amber-700",  fill: "bg-amber-500" },
  }[tone]
  const pct = cap > 0 ? Math.min((reserved / cap) * 100, 100) : 0
  return (
    <div
      className={cn(
        "flex min-w-[96px] flex-1 flex-col gap-1 rounded-lg border px-2.5 py-1.5",
        full ? "border-red-200 bg-red-50 text-red-700" : palette.base,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10.5px] font-semibold">
          {icon}
          {label}
        </span>
        <span className="font-mono text-[11px] font-bold">
          {reserved}/{cap}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className={cn("h-full rounded-full transition-all", full ? "bg-red-500" : palette.fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Slot card ─────────────────────────────────────────────────────────────

const SLOT_REC_CHIP = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red:   "bg-red-100 text-red-600",
} as const

function SlotCard({ s }: { s: SlotAllocation }) {
  const rec = s.recommendation
  return (
    <div className="flex flex-col gap-2.5 border-b border-border/40 px-5 py-3.5 last:border-0">
      {/* Top line: time + totals + recommendation */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-[52px] shrink-0 font-mono text-[15px] font-bold text-foreground">{s.time}</span>
        <span className="font-mono text-[12px] text-muted-foreground">
          {s.tablesReserved}/{GREEN_TABLES_PER_SLOT} tables
          {s.tablesPending > 0 && <span className="text-amber-600"> · {s.tablesPending} pending</span>}
          {" · "}{s.pax} pax
        </span>
        <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold", SLOT_REC_CHIP[rec.tone])}>
          {rec.headline}
        </span>
      </div>

      {/* Three categories */}
      <div className="flex flex-wrap gap-2">
        <CatPill icon={<Waves className="h-3 w-3" />} label="Seaview" reserved={s.seaviewReserved} cap={s.seaviewCap} tone="ocean" />
        <CatPill icon={<Armchair className="h-3 w-3" />} label="Sofa" reserved={s.sofaReserved} cap={s.sofaCap} tone="violet" />
        <CatPill icon={<Wine className="h-3 w-3" />} label="Bar" reserved={s.barReserved} cap={s.barCap} tone="amber" />
      </div>

      {/* Recommendation detail */}
      <p className="text-[12px] text-muted-foreground">{rec.detail}</p>
    </div>
  )
}

// ─── Legend / inventory cards ──────────────────────────────────────────────

function InvCard({ icon, label, total, rule, tone }: {
  icon: React.ReactNode; label: string; total: number; rule: string; tone: "ocean" | "violet" | "amber"
}) {
  const t = { ocean: "text-sky-600 bg-sky-50", violet: "text-violet-600 bg-violet-50", amber: "text-amber-600 bg-amber-50" }[tone]
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", t)}>{icon}</span>
      </div>
      <div className="text-[28px] font-bold leading-none tracking-tight">{total}</div>
      <div className="text-[12px] text-muted-foreground">{rule}</div>
    </div>
  )
}

export function CapacityFullView() {
  const { slots, isLoading, totalTables, totalPax, peakSlot, recommendation } = useTableCapacity()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* AI recommendation */}
      <RecommendationBanner rec={recommendation} />

      {/* Inventory cards */}
      <div className="flex flex-wrap gap-3">
        <InvCard
          icon={<Waves className="h-4 w-4" />}
          label="Seaview"
          total={VENUE_CAPACITY.seating.seaview.total}
          rule={`${SEAVIEW_CAP_PER_SLOT} reservable/slot · 9 walk-in`}
          tone="ocean"
        />
        <InvCard
          icon={<Armchair className="h-4 w-4" />}
          label="Sofa"
          total={VENUE_CAPACITY.seating.sofa.total}
          rule={`${SOFA_CAP_PER_SLOT}/slot · min ${VENUE_CAPACITY.seating.sofa.minPax} pax (2 slow hrs)`}
          tone="violet"
        />
        <InvCard
          icon={<Wine className="h-4 w-4" />}
          label="Bar (overflow)"
          total={VENUE_CAPACITY.seating.bar.total}
          rule={`${BAR_CAP_PER_SLOT}/slot · offer only after discussion`}
          tone="amber"
        />
      </div>

      {/* Tonight rollup */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3 text-[12.5px] shadow-sm">
        <span className="font-semibold text-foreground">Tonight:</span>
        <span className="text-muted-foreground">
          {totalTables} tables · {totalPax} pax · green cap {GREEN_TABLES_PER_SLOT}/slot, hard max {MAX_TABLES_PER_SLOT}
        </span>
        {peakSlot && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
            Peak {peakSlot.time} · {peakSlot.tablesReserved} tables
          </span>
        )}
      </div>

      {/* Per-slot breakdown + recommendation */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <span className="text-[13.5px] font-semibold text-foreground">Utilization &amp; allocation by time slot</span>
          <span className="text-[11px] text-muted-foreground">seaview · sofa · bar — what to accept</span>
        </div>
        <div className="flex flex-col">
          {slots.map((s) => (
            <SlotCard key={s.time} s={s} />
          ))}
        </div>
      </div>

      {/* Footnote */}
      <p className="px-1 text-[11.5px] text-muted-foreground">
        Reservations stop after {VENUE_CAPACITY.lastSlotHour}:00 — later arrivals are walk-in only. Seating type is
        inferred from each guest's table preference; seaview is the binding cap ({SEAVIEW_CAP_PER_SLOT}/slot).
      </p>
    </div>
  )
}
