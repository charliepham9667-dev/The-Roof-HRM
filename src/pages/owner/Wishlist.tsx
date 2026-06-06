import { useState, useMemo } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Trash2, Plus, Pencil, Wrench, ShoppingCart, Music2, RefreshCw, Download, ChevronDown, ChevronUp, FileText, Wallet, Boxes } from "lucide-react"
import { SheetEmbedTab } from "@/components/operations/SheetEmbedTab"
import { RequestOverviewPanel } from "@/components/operations/RequestOverviewPanel"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import {
  useWishlistItems,
  useCreateWishlistItem,
  useUpdateWishlistItem,
  useDeleteWishlistItem,
  type WishlistItem,
  type WishlistPriority,
  type WishlistStatus,
  type CreateWishlistItemInput,
} from "@/hooks/useWishlist"
import {
  useMaintenanceTasks,
  useCreateMaintenanceTask,
  useUpdateMaintenanceTask,
  useDeleteMaintenanceTask,
  type MaintenanceTask,
  type MaintenancePriority,
  type MaintenanceStatus,
  type MaintenanceCategory,
  type CreateMaintenanceTaskInput,
} from "@/hooks/useMaintenanceTasks"
import {
  useDJPayments,
  useUpdateDJPayment,
  useCreateDJPayment,
  useDJPaymentsSync,
  useDJProfiles,
  useUpsertDJProfile,
  formatVndAmount,
  formatTimeRange,
  classifyDJType,
  classifyDJPayer,
  isOwnerDJ,
  type DJPayment,
  type CreateDJPaymentInput,
} from "@/hooks/useDJPayments"

// ─── Shared config ─────────────────────────────────────────────────────────────

type BadgeVariant = BadgeProps["variant"]

// Maps a badge variant to its active-state CSS classes (for selector buttons)
const VARIANT_CLS: Record<NonNullable<BadgeVariant>, string> = {
  default:     "bg-primary/10 text-primary border-primary/25",
  secondary:   "bg-secondary text-secondary-foreground border-border",
  destructive: "bg-destructive/10 text-destructive border-destructive/25",
  outline:     "text-foreground border-border",
  positive:    "bg-success/10 text-success border-success/25",
  warning:     "bg-warning/10 text-warning border-warning/25",
  danger:      "bg-error/10 text-error border-error/25",
  neutral:     "bg-secondary text-muted-foreground border-border",
  brand:       "bg-primary/10 text-primary border-primary/25",
}

const PRIORITY_BADGE: Record<WishlistPriority, { label: string; variant: BadgeVariant }> = {
  high:   { label: "HIGH",   variant: "danger"  },
  medium: { label: "MEDIUM", variant: "warning" },
  low:    { label: "LOW",    variant: "neutral" },
}

const STATUS_BADGE: Record<WishlistStatus, { label: string; variant: BadgeVariant }> = {
  request:   { label: "Request",   variant: "neutral"  },
  approved:  { label: "Approved",  variant: "brand"    },
  ordered:   { label: "Ordered",   variant: "warning"  },
  delivered: { label: "Delivered", variant: "positive" },
}

const MAINT_STATUS_CONFIG: Record<MaintenanceStatus, { label: string; variant: BadgeVariant; col: string }> = {
  open:        { label: "Open",        variant: "neutral",  col: "border-t-muted-foreground" },
  in_progress: { label: "In Progress", variant: "warning",  col: "border-t-warning" },
  done:        { label: "Done",        variant: "positive", col: "border-t-success" },
}

const MAINT_PRIORITY_BADGE: Record<MaintenancePriority, { label: string; variant: BadgeVariant }> = {
  high:   { label: "HIGH",   variant: "danger"  },
  medium: { label: "MEDIUM", variant: "warning" },
  low:    { label: "LOW",    variant: "neutral" },
}

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  electrical: "Electrical",
  plumbing:   "Plumbing",
  structural: "Structural",
  equipment:  "Equipment",
  aesthetic:  "Aesthetic",
  safety:     "Safety",
  other:      "Other",
}



function formatVnd(amount: number | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("vi-VN", { style: "decimal" }).format(amount) + " ₫"
}

// ─── Procurement sheet ─────────────────────────────────────────────────────────

function defaultProcurementDraft(item?: WishlistItem | null): CreateWishlistItemInput {
  return {
    title: item?.title ?? "",
    quantity: item?.quantity ?? 1,
    estimatedCost: item?.estimatedCost ?? null,
    priority: item?.priority ?? "medium",
    status: item?.status ?? "request",
    notes: item?.notes ?? "",
  }
}

function WishlistItemSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  item?: WishlistItem | null
}) {
  const isEdit = !!item
  const isMobile = useIsMobile()
  const createItem = useCreateWishlistItem()
  const updateItem = useUpdateWishlistItem()

  const [draft, setDraft] = useState<CreateWishlistItemInput>(() => defaultProcurementDraft(item))
  const [error, setError] = useState<string | null>(null)

  useState(() => { setDraft(defaultProcurementDraft(item)); setError(null) })

  const isPending = createItem.isPending || updateItem.isPending

  async function handleSubmit() {
    if (!draft.title.trim()) { setError("Item name is required."); return }
    setError(null)
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, ...draft })
      } else {
        await createItem.mutateAsync(draft)
      }
      onOpenChange(false)
    } catch (e) {
      setError((e as Error)?.message || "Failed to save.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("p-0 flex flex-col", isMobile ? "max-h-[92dvh] rounded-t-2xl" : "sm:max-w-[440px] overflow-hidden")}
      >
        {isMobile && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-border" />}

        <SheetHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">{isEdit ? "Edit Item" : "Add Item"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Item Name *</label>
            <input
              type="text"
              className="form-input-base"
              placeholder="e.g. Cocktail Shakers (set of 6)"
              autoComplete="off"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                className="form-input-base"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Cost per (₫)</label>
              <input
                type="number"
                min={0}
                className="form-input-base"
                placeholder="0"
                value={draft.estimatedCost ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, estimatedCost: e.target.value ? parseFloat(e.target.value) : null }))}
              />
            </div>
          </div>

          {draft.estimatedCost != null && (
            <div className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
              Total: <span className="font-semibold text-foreground tabular-nums">{new Intl.NumberFormat("vi-VN").format(draft.quantity * draft.estimatedCost)} ₫</span>
            </div>
          )}

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Priority</label>
            <div className="flex gap-1.5">
              {(["high", "medium", "low"] as WishlistPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, priority: p }))}
                  className={cn(
                    "rounded-sm border px-3 py-1 text-[10px] tracking-wide uppercase transition-all",
                    draft.priority === p ? VARIANT_CLS[PRIORITY_BADGE[p].variant!] + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {PRIORITY_BADGE[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {(["request", "approved", "ordered", "delivered"] as WishlistStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, status: s }))}
                  className={cn(
                    "rounded-sm border px-3 py-1 text-[10px] tracking-wide transition-all",
                    draft.status === s ? VARIANT_CLS[STATUS_BADGE[s].variant!] + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {STATUS_BADGE[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Notes</label>
            <textarea
              rows={3}
              className="form-input-base resize-none"
              placeholder="Supplier preference, urgency notes..."
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 text-sm">Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="flex-1 h-10 text-sm">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Maintenance sheet ─────────────────────────────────────────────────────────

function defaultMaintenanceDraft(task?: MaintenanceTask | null): CreateMaintenanceTaskInput {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: task?.category ?? "other",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "open",
    location: task?.location ?? "",
    estimatedCost: task?.estimatedCost ?? null,
  }
}

function MaintenanceTaskSheet({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  task?: MaintenanceTask | null
}) {
  const isEdit = !!task
  const isMobile = useIsMobile()
  const createTask = useCreateMaintenanceTask()
  const updateTask = useUpdateMaintenanceTask()

  const [draft, setDraft] = useState<CreateMaintenanceTaskInput>(() => defaultMaintenanceDraft(task))
  const [error, setError] = useState<string | null>(null)

  useState(() => { setDraft(defaultMaintenanceDraft(task)); setError(null) })

  const isPending = createTask.isPending || updateTask.isPending

  async function handleSubmit() {
    if (!draft.title.trim()) { setError("Task title is required."); return }
    setError(null)
    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, ...draft })
      } else {
        await createTask.mutateAsync(draft)
      }
      onOpenChange(false)
    } catch (e) {
      setError((e as Error)?.message || "Failed to save.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("p-0 flex flex-col", isMobile ? "max-h-[92dvh] rounded-t-2xl" : "sm:max-w-[440px] overflow-hidden")}
      >
        {isMobile && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-border" />}

        <SheetHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit Task" : "Log Maintenance Task"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Title *</label>
            <input
              type="text"
              className="form-input-base"
              placeholder="e.g. Fix AC unit on 3rd floor"
              autoComplete="off"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Category</label>
              <select
                className="form-input-base"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as MaintenanceCategory }))}
              >
                {(["electrical","plumbing","structural","equipment","aesthetic","safety","other"] as MaintenanceCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Location</label>
              <input
                type="text"
                className="form-input-base"
                placeholder="e.g. Bar area, Rooftop"
                autoComplete="off"
                value={draft.location ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Priority</label>
            <div className="flex gap-1.5">
              {(["high", "medium", "low"] as MaintenancePriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, priority: p }))}
                  className={cn(
                    "rounded-sm border px-3 py-0.5 text-[10px] tracking-wide uppercase transition-all",
                    draft.priority === p ? VARIANT_CLS[MAINT_PRIORITY_BADGE[p].variant!] + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {MAINT_PRIORITY_BADGE[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widests font-medium text-muted-foreground uppercase block mb-1.5">Status</label>
            <div className="flex gap-1.5">
              {(["open", "in_progress", "done"] as MaintenanceStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, status: s }))}
                  className={cn(
                    "rounded-sm border px-3 py-0.5 text-[10px] tracking-wide transition-all",
                    draft.status === s ? VARIANT_CLS[MAINT_STATUS_CONFIG[s].variant!] + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {MAINT_STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Est. Cost (₫)</label>
            <input
              type="number"
              min={0}
              className="form-input-base"
              placeholder="0"
              value={draft.estimatedCost ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, estimatedCost: e.target.value ? parseFloat(e.target.value) : null }))}
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Description</label>
            <textarea
              rows={3}
              className="form-input-base resize-none"
              placeholder="Details, contractor info, urgency..."
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 text-sm">Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="flex-1 h-10 text-sm">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Log Task"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Status section config ─────────────────────────────────────────────────────

const STATUS_SECTION: Record<WishlistStatus, {
  label: string
  accent: string
  sectionBg: string
  badgeBg: string
  borderTop: string
}> = {
  request:   { label: "Requested",  accent: "#6b7280", sectionBg: "#f4f4f5", badgeBg: "#f3f4f6", borderTop: "#6b7280" },
  approved:  { label: "Approved",   accent: "#3b82f6", sectionBg: "#eff6ff", badgeBg: "#dbeafe", borderTop: "#3b82f6" },
  ordered:   { label: "Ordered",    accent: "#f59e0b", sectionBg: "#fffbeb", badgeBg: "#fef3c7", borderTop: "#f59e0b" },
  delivered: { label: "Delivered",  accent: "#10b981", sectionBg: "#ecfdf5", badgeBg: "#d1fae5", borderTop: "#10b981" },
}

const STATUS_ORDER: WishlistStatus[] = ["request", "approved", "ordered", "delivered"]

// ─── Procurement tab ───────────────────────────────────────────────────────────

function ProcurementTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<WishlistStatus | "all">("all")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)

  const { data: items = [], isLoading } = useWishlistItems()
  const deleteItem = useDeleteWishlistItem()

  const filtered = useMemo(() =>
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter),
    [items, statusFilter]
  )

  const grouped = useMemo(() =>
    STATUS_ORDER.reduce<Record<WishlistStatus, WishlistItem[]>>((acc, s) => {
      acc[s] = items.filter((i) => i.status === s)
      return acc
    }, {} as Record<WishlistStatus, WishlistItem[]>),
    [items]
  )

  const totalPendingSpend = useMemo(() =>
    items.filter((i) => i.status !== "delivered").reduce((s, i) => s + (i.estimatedCost ?? 0) * i.quantity, 0),
    [items]
  )

  function openAdd() { setEditingItem(null); setSheetOpen(true) }
  function openEdit(item: WishlistItem) { setEditingItem(item); setSheetOpen(true) }
  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return
    await deleteItem.mutateAsync(id)
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Controls bar */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="shrink-0 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none cursor-pointer"
        >
          <option value="all">All Status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_SECTION[s].label}</option>
          ))}
        </select>
        {canManage && (
          <Button type="button" size="sm" onClick={openAdd} className="ml-auto h-8 px-3 text-xs gap-1 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        )}
      </div>

      {/* Summary strip — tap a column to filter */}
      {!isLoading && items.length > 0 && (
        <div className="shrink-0 rounded-card border border-border bg-card shadow-card overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-border/50">
            {STATUS_ORDER.map((s) => {
              const cfg = STATUS_SECTION[s]
              const SHORT: Record<WishlistStatus, string> = { request: "Req", approved: "App", ordered: "Ord", delivered: "Del" }
              const count = grouped[s].length
              const spend = grouped[s].reduce((sum, i) => sum + (i.estimatedCost ?? 0) * i.quantity, 0)
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(isActive ? "all" : s)}
                  className={cn("flex flex-col items-center px-2 py-2 gap-0.5 transition-colors hover:bg-secondary/30", isActive && "bg-secondary/40")}
                >
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.accent }} />
                    <span className="text-[10px] font-bold" style={{ color: cfg.accent }}>{SHORT[s]}</span>
                    <span className="text-[10px] font-bold" style={{ color: cfg.accent }}>{count}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                    {spend > 0 ? formatVnd(spend) : "—"}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="border-t border-border/50 px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Pending spend</span>
            <span className="text-[10px] font-bold tabular-nums text-foreground">{formatVnd(totalPendingSpend)}</span>
          </div>
        </div>
      )}

      {/* Grouped list sorted by status */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="text-sm text-muted-foreground">No items found.</div>
          {canManage && (
            <button type="button" onClick={openAdd} className="text-xs text-primary hover:underline">+ Add first item</button>
          )}
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card shadow-card" style={{ overflow: 'clip' }}>
          {STATUS_ORDER.map((status) => {
            const sectionItems = filtered.filter((i) => i.status === status)
            if (sectionItems.length === 0) return null
            const cfg = STATUS_SECTION[status]
            return (
              <div key={status}>
                {/* Status divider header — sticky within the single card */}
                <div
                  className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-border shadow-sm backdrop-blur-0"
                  style={{ background: cfg.sectionBg, borderTop: `2px solid ${cfg.accent}` }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cfg.accent }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>{cfg.label}</span>
                  <span className="rounded-full px-1.5 py-px text-[9px] font-bold" style={{ background: `${cfg.accent}22`, color: cfg.accent }}>{sectionItems.length}</span>
                </div>
                {/* Items in this status */}
                <div className="divide-y divide-border/40">
                  {sectionItems.map((item) => {
                    const pri = PRIORITY_BADGE[item.priority]
                    const totalCost = (item.estimatedCost ?? 0) * item.quantity
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2"
                        style={{ borderLeft: `3px solid ${cfg.accent}55` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-medium text-foreground leading-snug truncate">{item.title}</span>
                            <Badge variant={pri.variant} className="shrink-0 text-[9px] px-1.5 py-px">{pri.label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">×<span className="font-medium text-foreground">{item.quantity}</span></span>
                            {(totalCost || item.estimatedCost) ? (
                              <span className="text-[11px] tabular-nums font-medium text-foreground">{formatVnd(totalCost || item.estimatedCost)}</span>
                            ) : null}
                            {item.notes && (
                              <span className="text-[10px] italic text-muted-foreground truncate">{item.notes}</span>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button type="button" onClick={() => openEdit(item)} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDelete(item.id)} className="rounded p-1.5 text-muted-foreground hover:text-error hover:bg-muted transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <WishlistItemSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditingItem(null) }}
        item={editingItem}
        key={editingItem?.id ?? "new"}
      />
    </div>
  )
}

// ─── Maintenance tab ───────────────────────────────────────────────────────────

const MAINT_STATUS_ORDER: MaintenanceStatus[] = ["open", "in_progress", "done"]

const MAINT_STATUS_ACCENT: Record<MaintenanceStatus, string> = {
  open:        "#6b7280",
  in_progress: "#f59e0b",
  done:        "#10b981",
}

function MaintenanceTab({ canManage }: { canManage: boolean }) {
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory | "all">("all")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null)
  // Collapse "done" by default — it tends to accumulate
  const [collapsedSections, setCollapsedSections] = useState<Set<MaintenanceStatus>>(new Set(["done"]))

  const { data: tasks = [], isLoading } = useMaintenanceTasks()
  const deleteTask = useDeleteMaintenanceTask()
  const updateTask = useUpdateMaintenanceTask()

  const filtered = useMemo(() => tasks.filter((t) => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false
    return true
  }), [tasks, priorityFilter, categoryFilter])

  const grouped = useMemo(() =>
    MAINT_STATUS_ORDER.reduce<Record<MaintenanceStatus, MaintenanceTask[]>>((acc, s) => {
      acc[s] = filtered.filter((t) => t.status === s)
      return acc
    }, {} as Record<MaintenanceStatus, MaintenanceTask[]>),
    [filtered]
  )

  function openAdd() { setEditingTask(null); setSheetOpen(true) }
  function openEdit(task: MaintenanceTask) { setEditingTask(task); setSheetOpen(true) }
  async function handleDelete(id: string) {
    if (!confirm("Delete this task?")) return
    await deleteTask.mutateAsync(id)
  }
  async function cycleStatus(task: MaintenanceTask) {
    const next: Record<MaintenanceStatus, MaintenanceStatus> = { open: "in_progress", in_progress: "done", done: "open" }
    await updateTask.mutateAsync({ id: task.id, status: next[task.status] })
  }
  function toggleSection(s: MaintenanceStatus) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const openCount = filtered.filter((t) => t.status === "open").length
  const inProgressCount = filtered.filter((t) => t.status === "in_progress").length
  const doneCount = filtered.filter((t) => t.status === "done").length

  return (
    <div className="flex flex-col gap-3">
      {/* Controls bar */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as any)}
          className="shrink-0 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="shrink-0 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="electrical">Electrical</option>
          <option value="plumbing">Plumbing</option>
          <option value="structural">Structural</option>
          <option value="equipment">Equipment</option>
          <option value="aesthetic">Aesthetic</option>
          <option value="safety">Safety</option>
          <option value="other">Other</option>
        </select>
        {canManage && (
          <Button type="button" size="sm" onClick={openAdd} className="ml-auto h-8 px-3 text-xs gap-1 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Log Task
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Summary strip — mobile only */}
          {filtered.length > 0 && (
            <div className="shrink-0 rounded-card border border-border bg-card shadow-card overflow-hidden md:hidden">
              <div className="grid grid-cols-3 divide-x divide-border/50">
                {([
                  { status: "open" as MaintenanceStatus, count: openCount, label: "Open" },
                  { status: "in_progress" as MaintenanceStatus, count: inProgressCount, label: "In Progress" },
                  { status: "done" as MaintenanceStatus, count: doneCount, label: "Done" },
                ]).map(({ status, count, label }) => {
                  const accent = MAINT_STATUS_ACCENT[status]
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleSection(status)}
                      className="flex flex-col items-center px-2 py-2 gap-0.5 transition-colors hover:bg-secondary/30"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
                      <span className="text-base font-bold tabular-nums" style={{ color: accent }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mobile: single card with sticky section dividers */}
          <div className="md:hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="text-sm text-muted-foreground">No tasks found.</div>
                {canManage && (
                  <button type="button" onClick={openAdd} className="text-xs text-primary hover:underline">+ Log first task</button>
                )}
              </div>
            ) : (
              <div className="rounded-card border border-border shadow-card bg-card" style={{ overflow: 'clip' }}>
                {MAINT_STATUS_ORDER.map((status) => {
                  const accent = MAINT_STATUS_ACCENT[status]
                  const cfg = MAINT_STATUS_CONFIG[status]
                  const sectionTasks = grouped[status]
                  const isCollapsed = collapsedSections.has(status)

                  if (sectionTasks.length === 0) return null

                  return (
                    <div key={status}>
                      {/* Sticky section header — floats within the single card */}
                      <button
                        type="button"
                        onClick={() => toggleSection(status)}
                        className="sticky top-0 z-10 w-full flex items-center justify-between px-3 py-2 border-b border-border shadow-sm transition-colors hover:bg-secondary/20"
                        style={{ borderTop: `2px solid ${accent}`, background: 'var(--card, #ffffff)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>
                            {cfg.label}
                          </span>
                          <span
                            className="rounded-full px-1.5 py-px text-[10px] font-semibold"
                            style={{ background: `${accent}22`, color: accent }}
                          >
                            {sectionTasks.length}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="divide-y divide-border/40">
                          {sectionTasks.map((task) => {
                            const pri = MAINT_PRIORITY_BADGE[task.priority]
                            return (
                              <div
                                key={task.id}
                                className="flex items-center gap-2 px-3 py-2"
                                style={{ borderLeft: `3px solid ${accent}55` }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      onClick={() => canManage && openEdit(task)}
                                      className={cn("text-[13px] font-medium text-foreground leading-snug truncate", canManage && "cursor-pointer")}
                                    >
                                      {task.title}
                                    </span>
                                    <Badge variant={pri.variant} className="shrink-0 text-[9px] px-1.5 py-px">{pri.label}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <Badge variant="neutral" className="text-[9px] px-1.5 py-px">{CATEGORY_LABELS[task.category]}</Badge>
                                    {task.location && (
                                      <span className="text-[10px] text-muted-foreground">📍 {task.location}</span>
                                    )}
                                    {task.estimatedCost != null && (
                                      <span className="text-[10px] tabular-nums text-muted-foreground">{formatVnd(task.estimatedCost)}</span>
                                    )}
                                    {canManage && (
                                      <button
                                        type="button"
                                        onClick={() => cycleStatus(task)}
                                        className="text-[9px] font-medium text-primary hover:underline transition-colors"
                                      >
                                        {status === "open" ? "→ In Progress" : status === "in_progress" ? "→ Done" : "↺ Reopen"}
                                      </button>
                                    )}
                                  </div>
                                  {task.description && (
                                    <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{task.description}</div>
                                  )}
                                </div>
                                {canManage && (
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button type="button" onClick={() => openEdit(task)} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(task.id)} className="rounded p-1.5 text-muted-foreground hover:text-error hover:bg-muted transition-colors">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Desktop: kanban */}
          <div className="hidden md:flex md:flex-row md:flex-1 md:min-h-0 gap-2">
            {MAINT_STATUS_ORDER.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col)
              const cfg = MAINT_STATUS_CONFIG[col]
              return (
                <div key={col} className="flex flex-col w-full md:flex-1 md:min-h-0 rounded-card border border-border overflow-hidden shadow-card">
                  <div className={cn("border-b border-border bg-card px-3 py-2 border-t-2 shrink-0", cfg.col)}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">{cfg.label}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground">{colTasks.length}</span>
                    </div>
                  </div>
                  <div className="flex flex-col divide-y divide-border/40 overflow-y-auto flex-1 bg-card">
                    {colTasks.length === 0 ? (
                      <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">No tasks</div>
                    ) : (
                      colTasks.map((task) => {
                        const pri = MAINT_PRIORITY_BADGE[task.priority]
                        return (
                          <div key={task.id} className="px-3 py-2 hover:bg-secondary/20 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                onClick={() => canManage && openEdit(task)}
                                className={cn("text-[13px] font-medium text-foreground leading-snug flex-1 min-w-0 truncate", canManage && "cursor-pointer hover:text-primary transition-colors")}
                              >
                                {task.title}
                              </span>
                              {canManage && (
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => openEdit(task)} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => handleDelete(task.id)} className="rounded p-1.5 text-muted-foreground hover:text-error hover:bg-muted transition-colors">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <Badge variant={pri.variant} className="text-[9px] px-1.5 py-px">{pri.label}</Badge>
                              <Badge variant="neutral" className="text-[9px] px-1.5 py-px">{CATEGORY_LABELS[task.category]}</Badge>
                              {task.location && <span className="text-[10px] text-muted-foreground truncate">📍 {task.location}</span>}
                              {task.estimatedCost != null && (
                                <span className="text-[10px] tabular-nums text-muted-foreground ml-auto shrink-0">{formatVnd(task.estimatedCost)}</span>
                              )}
                            </div>
                            {task.description && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{task.description}</div>
                            )}
                            {canManage && (
                              <button type="button" onClick={() => cycleStatus(task)} className="mt-1.5 text-[9px] font-medium text-primary hover:underline transition-colors">
                                {col === "open" ? "→ In Progress" : col === "in_progress" ? "→ Done" : "↺ Reopen"}
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <MaintenanceTaskSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditingTask(null) }}
        task={editingTask}
        key={editingTask?.id ?? "new-maintenance"}
      />
    </div>
  )
}

// ─── DJ Payments tab ───────────────────────────────────────────────────────────

const DJ_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: "Scheduled", variant: "brand"    },
  done:      { label: "Done",      variant: "positive" },
  no_show:   { label: "No Show",   variant: "danger"   },
}

const DJ_PAY_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  paid:   { label: "Paid",   variant: "positive" },
  unpaid: { label: "Unpaid", variant: "warning"  },
  na:     { label: "N/A",    variant: "neutral"  },
}

const DJ_PAYER_CONFIG = {
  foreigner_charlie: { label: "Charlie",  cls: "text-blue-600" },
  local_company:     { label: "Company",  cls: "text-green-600" },
} as const

function defaultDjDraft(p?: DJPayment | null): CreateDJPaymentInput {
  return {
    date: p?.date ?? new Date().toISOString().slice(0, 10),
    event_name: p?.event_name ?? "",
    event_type: p?.event_type ?? "default",
    dj_name: p?.dj_name ?? "",
    dj_type: p?.dj_type ?? undefined,
    set_start: p?.set_start?.slice(0, 5) ?? "",
    set_end: p?.set_end?.slice(0, 5) ?? "",
    amount_vnd: p?.amount_vnd ?? undefined,
    payer_type: p?.payer_type ?? undefined,
    status: p?.status ?? "scheduled",
    payment_status: p?.payment_status ?? "unpaid",
    receipt_uploaded: p?.receipt_uploaded ?? false,
    notes: p?.notes ?? "",
  }
}

function DJPaymentSheet({
  open,
  onOpenChange,
  payment,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  payment?: DJPayment | null
}) {
  const isEdit = !!payment
  const isMobile = useIsMobile()
  const create = useCreateDJPayment()
  const update = useUpdateDJPayment()
  const [draft, setDraft] = useState<CreateDJPaymentInput>(() => defaultDjDraft(payment))
  const [amtOverride, setAmtOverride] = useState(payment?.amount_override ?? false)
  const [error, setError] = useState<string | null>(null)

  useState(() => { setDraft(defaultDjDraft(payment)); setAmtOverride(payment?.amount_override ?? false); setError(null) })

  const isPending = create.isPending || update.isPending

  function set<K extends keyof CreateDJPaymentInput>(k: K, v: CreateDJPaymentInput[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  async function handleSubmit() {
    if (!draft.dj_name.trim()) { setError("DJ name is required."); return }
    if (!draft.date) { setError("Date is required."); return }
    if (!draft.event_name.trim()) { setError("Event name is required."); return }
    setError(null)
    try {
      const payload = {
        ...draft,
        dj_type: draft.dj_type ?? classifyDJType(draft.dj_name),
        payer_type: draft.payer_type ?? classifyDJPayer(draft.dj_name),
      }
      if (isEdit && payment) {
        await update.mutateAsync({
          id: payment.id,
          status: payload.status,
          payment_status: payload.payment_status,
          amount_vnd: payload.amount_vnd,
          amount_override: amtOverride,
          receipt_uploaded: payload.receipt_uploaded,
          notes: payload.notes,
          payer_type: payload.payer_type,
          dj_type: payload.dj_type,
        })
      } else {
        await create.mutateAsync({ ...payload, amount_override: amtOverride })
      }
      onOpenChange(false)
    } catch (e) {
      setError((e as Error)?.message || "Failed to save.")
    }
  }

  const inputCls = "w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
  const selectCls = inputCls + " cursor-pointer"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("p-0 flex flex-col", isMobile ? "max-h-[92dvh] rounded-t-2xl" : "sm:max-w-[420px] overflow-hidden")}
      >
        {isMobile && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-border" />}

        <SheetHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit DJ Set" : "Add DJ Set"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Date *</label>
              <input type="date" className={inputCls} value={draft.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Event Type</label>
              <select className={selectCls} value={draft.event_type} onChange={(e) => set("event_type", e.target.value)}>
                <option value="default">Default</option>
                <option value="tet">Tết (1.5×)</option>
                <option value="new_year">New Year (1.5×)</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Event Name *</label>
            <input type="text" className={inputCls} placeholder="e.g. SaturPlay" autoComplete="off" value={draft.event_name} onChange={(e) => set("event_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">DJ Name *</label>
              <input type="text" className={inputCls} placeholder="e.g. CharleS" autoComplete="off" value={draft.dj_name} onChange={(e) => set("dj_name", e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">DJ Type</label>
              <select className={selectCls} value={draft.dj_type ?? ""} onChange={(e) => set("dj_type", (e.target.value || undefined) as any)}>
                <option value="">Auto</option>
                <option value="foreigner">Foreigner</option>
                <option value="local">Local</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Set Start</label>
              <input type="time" className={inputCls} value={draft.set_start ?? ""} onChange={(e) => set("set_start", e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Set End</label>
              <input type="time" className={inputCls} value={draft.set_end ?? ""} onChange={(e) => set("set_end", e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase">Amount (₫)</label>
              <label className="flex items-center gap-1 ml-auto cursor-pointer">
                <input type="checkbox" className="h-3 w-3" checked={amtOverride} onChange={(e) => setAmtOverride(e.target.checked)} />
                <span className="text-[10px] text-muted-foreground">Manual override</span>
              </label>
            </div>
            <input
              type="number"
              className={inputCls}
              placeholder="Auto-calculated"
              value={draft.amount_vnd ?? ""}
              disabled={!amtOverride}
              onChange={(e) => set("amount_vnd", e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Payer</label>
              <select className={selectCls} value={draft.payer_type ?? ""} onChange={(e) => set("payer_type", (e.target.value || undefined) as any)}>
                <option value="">Auto</option>
                <option value="foreigner_charlie">Charlie</option>
                <option value="local_company">Company</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Status</label>
              <select className={selectCls} value={draft.status ?? "scheduled"} onChange={(e) => set("status", e.target.value as any)}>
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Payment Status</label>
              <select className={selectCls} value={draft.payment_status ?? "unpaid"} onChange={(e) => set("payment_status", e.target.value as any)}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="na">N/A</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Receipt</label>
              <select className={selectCls} value={draft.receipt_uploaded ? "yes" : "no"} onChange={(e) => set("receipt_uploaded", e.target.value === "yes")}>
                <option value="no">Not uploaded</option>
                <option value="yes">Uploaded ✓</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Notes</label>
            <textarea rows={3} className={inputCls + " resize-none"} placeholder="Any notes…" value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 text-sm">Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="flex-1 h-10 text-sm">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Set"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── DJ Profiles modal ─────────────────────────────────────────────────────────

function DJProfilesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profiles = [], isLoading } = useDJProfiles()
  const { data: payments = [] } = useDJPayments()
  const upsert = useUpsertDJProfile()

  // Build a list of unique DJ names from both profiles + payments
  const allNames = useMemo(() => {
    const nameSet = new Set<string>()
    profiles.forEach(p => nameSet.add(p.dj_name.toLowerCase()))
    payments.forEach(p => {
      if (p.dj_name) nameSet.add(p.dj_name.toLowerCase())
    })
    // Create display map: prefer profile display name, fall back to payment name casing
    const displayMap = new Map<string, string>()
    payments.forEach(p => { if (p.dj_name) displayMap.set(p.dj_name.toLowerCase(), p.dj_name) })
    profiles.forEach(p => { if (p.dj_name_display) displayMap.set(p.dj_name.toLowerCase(), p.dj_name_display) })
    return Array.from(nameSet)
      .filter(n => !isOwnerDJ(n))
      .sort()
      .map(name => ({
        name,
        display: displayMap.get(name) ?? name,
        profile: profiles.find(p => p.dj_name.toLowerCase() === name) ?? null,
      }))
  }, [profiles, payments])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">DJ Profiles</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Changes here persist across syncs — the spreadsheet won't override them.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">×</button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : allNames.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No DJs found. Sync first to populate.</div>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto -mx-2 px-2">
            {allNames.map(({ name, display, profile }) => {
              const currentType = profile?.dj_type ?? classifyDJType(name)
              const currentPayer = profile?.payer_type ?? classifyDJPayer(name)
              const saving = upsert.isPending

              return (
                <div key={name} className="py-3 flex items-center justify-between gap-4">
                  <span className="font-medium text-sm text-foreground capitalize min-w-[90px]">{display}</span>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Type toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                      {(["local", "foreigner"] as const).map(t => (
                        <button
                          key={t}
                          disabled={saving}
                          onClick={() => upsert.mutate({
                            dj_name: name,
                            dj_name_display: display,
                            dj_type: t,
                            payer_type: t === "foreigner" ? "foreigner_charlie" : "local_company",
                          })}
                          className={cn(
                            "px-3 py-1.5 font-medium transition-colors",
                            currentType === t
                              ? t === "foreigner"
                                ? "bg-blue-500 text-white"
                                : "bg-green-500 text-white"
                              : "bg-card text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {t === "foreigner" ? "✈ Intl" : "🇻🇳 Local"}
                        </button>
                      ))}
                    </div>

                    {/* Payer toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                      {(["foreigner_charlie", "local_company"] as const).map(pt => (
                        <button
                          key={pt}
                          disabled={saving}
                          onClick={() => upsert.mutate({
                            dj_name: name,
                            dj_name_display: display,
                            dj_type: currentType,
                            payer_type: pt,
                          })}
                          className={cn(
                            "px-3 py-1.5 font-medium transition-colors",
                            currentPayer === pt
                              ? "bg-[#78350F] text-white"
                              : "bg-card text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {pt === "foreigner_charlie" ? "Charlie" : "Company"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          <strong>Type</strong> (Intl / Local) controls rate multipliers. <strong>Payer</strong> (Charlie / Company) controls who settles the invoice.
        </p>
      </div>
    </div>
  )
}

function DJPaymentsTab({ canManage }: { canManage: boolean }) {
  const { data: payments = [], isLoading } = useDJPayments()
  const update = useUpdateDJPayment()
  const { sync } = useDJPaymentsSync()

  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "scheduled" | "no_show">("all")
  const [payFilter, setPayFilter] = useState<"all" | "unpaid" | "paid">("all")
  const [payerFilter, setPayerFilter] = useState<"all" | "foreigner_charlie" | "local_company">("all")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DJPayment | null>(null)
  const [profilesOpen, setProfilesOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const todayIso = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => payments.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false
    if (payFilter !== "all" && p.payment_status !== payFilter) return false
    if (payerFilter !== "all" && p.payer_type !== payerFilter) return false
    return true
  }), [payments, statusFilter, payFilter, payerFilter])

  // Group by YYYY-MM
  const grouped = useMemo(() => {
    const map = new Map<string, DJPayment[]>()
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
    for (const p of sorted) {
      const key = p.date.slice(0, 7) // YYYY-MM
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [filtered])

  // Summary stats
  const stats = useMemo(() => {
    const totalSets = payments.length
    const uniqueDJs = new Set(payments.map((p) => p.dj_name.toLowerCase())).size
    const totalPaid = payments.filter((p) => p.payment_status === "paid").reduce((s, p) => s + (p.amount_vnd ?? 0), 0)
    const outstanding = payments.filter((p) => p.payment_status === "unpaid" && p.status !== "no_show").reduce((s, p) => s + (p.amount_vnd ?? 0), 0)
    const noShows = payments.filter((p) => p.status === "no_show").length
    return { totalSets, uniqueDJs, totalPaid, outstanding, noShows }
  }, [payments])

  const filteredPaid = useMemo(() => filtered.filter((p) => p.payment_status === "paid").reduce((s, p) => s + (p.amount_vnd ?? 0), 0), [filtered])
  const filteredOutstanding = useMemo(() => filtered.filter((p) => p.payment_status === "unpaid" && p.status !== "no_show").reduce((s, p) => s + (p.amount_vnd ?? 0), 0), [filtered])

  function openAdd() { setEditing(null); setSheetOpen(true) }
  function openEdit(p: DJPayment) { setEditing(p); setSheetOpen(true) }

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleSync() {
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const result = await sync()
      const parts = [`${result.upserted} sets synced`]
      if (result.skipped) parts.push(`${result.skipped} skipped`)
      if (result.unmappedDJs.length) parts.push(`Unknown DJs: ${[...new Set(result.unmappedDJs)].join(", ")}`)
      if (result.errors.length) parts.push(`Errors: ${result.errors.slice(0, 2).join("; ")}`)
      setSyncMsg(parts.join(" · "))
    } catch (e) {
      setSyncMsg(`Sync failed: ${e}`)
    } finally {
      setIsSyncing(false)
    }
  }

  function exportCsv() {
    const headers = ["Date", "Event", "DJ", "Type", "Set Time", "Duration (h)", "Multiplier", "Amount (VND)", "Payer", "Status", "Payment", "Receipt", "Notes"]
    const rows = filtered.map((p) => [
      p.date,
      p.event_name,
      p.dj_name,
      p.dj_type ?? "",
      formatTimeRange(p.set_start, p.set_end),
      p.duration_hours ?? "",
      p.multiplier,
      p.amount_vnd ?? "",
      p.payer_type ?? "",
      p.status,
      p.payment_status,
      p.receipt_uploaded ? "yes" : "no",
      p.notes ?? "",
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dj-payments-${todayIso}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-")
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const filterBtnCls = (active: boolean) => cn(
    "px-3 py-1 rounded text-[10px] font-semibold border transition-colors",
    active
      ? "bg-foreground/10 border-foreground/20 text-foreground"
      : "bg-transparent border-border text-muted-foreground hover:bg-secondary"
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Sync bar */}
      <div className="flex items-center gap-2 rounded-card border border-border bg-card px-3 py-1.5 shrink-0 shadow-card">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
        <span className="text-[10px] text-muted-foreground truncate flex-1">
          <span className="hidden sm:inline">Source: </span>
          <span className="font-medium text-foreground">HQ Calendar</span>
          <span className="mx-1 opacity-30">·</span>Jan – Today
        </span>
        {syncMsg && (
          <span className="text-[9px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline">{syncMsg}</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && (
            <button
              type="button"
              onClick={() => setProfilesOpen(true)}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Profiles
            </button>
          )}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
            <span className="hidden sm:inline">{isSyncing ? "Syncing…" : "Sync"}</span>
          </button>
        </div>
      </div>

      <DJProfilesModal open={profilesOpen} onClose={() => setProfilesOpen(false)} />

      {/* Summary strip — compact horizontal bar */}
      <div className="shrink-0 rounded-card border border-border bg-card shadow-card overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border/50">
          {/* Sets */}
          <div className="flex flex-col items-center px-2 py-1.5 gap-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sets</span>
            <span className="text-[13px] font-bold text-foreground tabular-nums">{stats.totalSets}</span>
          </div>
          {/* Total Paid */}
          <div className="flex flex-col items-center px-2 py-1.5 gap-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-green-700">Paid</span>
            <span className="text-[11px] font-semibold tabular-nums text-green-700 text-center leading-tight">
              {formatVndAmount(stats.totalPaid)}<span className="ml-0.5">₫</span>
            </span>
          </div>
          {/* Outstanding */}
          <div className="flex flex-col items-center px-2 py-1.5 gap-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#b5620a]">Owed</span>
            <span className="text-[11px] font-semibold tabular-nums text-[#b5620a] text-center leading-tight">
              {stats.outstanding > 0 ? <>{formatVndAmount(stats.outstanding)}<span className="ml-0.5">₫</span></> : <span className="text-muted-foreground">—</span>}
            </span>
          </div>
        </div>
        {/* Desktop extras */}
        <div className="hidden md:flex divide-x divide-border/50 border-t border-border/50">
          <div className="flex flex-col px-4 py-1.5 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Unique DJs</span>
            <span className="text-sm font-semibold text-foreground">{stats.uniqueDJs}</span>
          </div>
          <div className="flex flex-col px-4 py-1.5 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">No Shows</span>
            <span className="text-sm font-semibold text-foreground">{stats.noShows}</span>
          </div>
        </div>
      </div>

      {/* Filter bar — desktop only */}
      <div className="hidden sm:flex flex-wrap items-center gap-1.5">
        {/* Status */}
        <div className="flex items-center gap-0.5 rounded border border-border bg-card p-0.5">
          {(["all", "done", "scheduled", "no_show"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setStatusFilter(v)} className={filterBtnCls(statusFilter === v)}>
              {v === "all" ? "All" : v === "no_show" ? "No Show" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Payment */}
        <div className="flex items-center gap-0.5 rounded border border-border bg-card p-0.5">
          {(["all", "unpaid", "paid"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setPayFilter(v)} className={filterBtnCls(payFilter === v)}>
              {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Payer */}
        <div className="flex items-center gap-0.5 rounded border border-border bg-card p-0.5">
          {(["all", "foreigner_charlie", "local_company"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setPayerFilter(v)} className={filterBtnCls(payerFilter === v)}>
              {v === "all" ? "All" : v === "foreigner_charlie" ? "Charlie" : "Company"}
            </button>
          ))}
        </div>
        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button type="button" variant="outline" onClick={exportCsv} className="h-7 px-2.5 text-[10px]">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          {canManage && (
            <Button type="button" onClick={openAdd} className="h-7 px-2.5 text-[10px]">
              <Plus className="h-3 w-3" />
              Add Set
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Music2 className="h-8 w-8 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">No DJ sets found.</div>
            {canManage && (
              <button type="button" onClick={openAdd} className="text-xs text-primary hover:underline">+ Add first set</button>
            )}
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full border-collapse text-xs min-w-[900px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Date", "Event", "DJ", "Set Time", "Dur.", "Rate", "Status", "Payment", "Amount (₫)", "Payer", "Receipt", "Notes", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold tracking-widest uppercase text-muted-foreground whitespace-nowrap border-b border-border">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([monthKey, rows]) => {
                  const isExpanded = !expandedMonths.has(monthKey)
                  const monthPaid = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + (r.amount_vnd ?? 0), 0)
                  const monthOut = rows.filter((r) => r.payment_status === "unpaid" && r.status !== "no_show").reduce((s, r) => s + (r.amount_vnd ?? 0), 0)

                  return [
                    // Month header row
                    <tr key={`month-${monthKey}`} className="bg-muted/30 border-b border-border">
                      <td colSpan={13} className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggleMonth(monthKey)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{monthLabel(monthKey)}</span>
                          <span className="rounded-full bg-border/60 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{rows.length}</span>
                          {monthPaid > 0 && <span className="text-[10px] text-green-700 tabular-nums">Paid: {formatVndAmount(monthPaid)} ₫</span>}
                          {monthOut > 0 && <span className="text-[10px] text-[#b5620a] tabular-nums">Outstanding: {formatVndAmount(monthOut)} ₫</span>}
                        </button>
                      </td>
                    </tr>,
                    // Data rows
                    ...(isExpanded ? rows.map((p) => {
                      const isTonight = p.date === todayIso
                      const isOutstanding = p.payment_status === "unpaid" && p.status === "done"
                      const isNoShow = p.status === "no_show"
                      const statusCfg = DJ_STATUS_CONFIG[p.status as keyof typeof DJ_STATUS_CONFIG]
                        ?? { label: p.status, cls: "bg-muted text-muted-foreground border-border" }
                      const payCfg = DJ_PAY_CONFIG[p.payment_status as keyof typeof DJ_PAY_CONFIG]
                        ?? { label: p.payment_status, cls: "bg-muted text-muted-foreground border-border" }
                      const payerCfg = p.payer_type ? (DJ_PAYER_CONFIG[p.payer_type as keyof typeof DJ_PAYER_CONFIG] ?? null) : null

                      const STATUS_CYCLE: DJPayment["status"][] = ["scheduled", "done", "no_show"]
                      const PAY_CYCLE: DJPayment["payment_status"][] = ["unpaid", "paid", "na"]

                      function cycleStatus(e: React.MouseEvent) {
                        e.stopPropagation()
                        if (!canManage) return
                        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status) + 1) % STATUS_CYCLE.length]
                        update.mutate({ id: p.id, status: next })
                      }

                      function cyclePayment(e: React.MouseEvent) {
                        e.stopPropagation()
                        if (!canManage || isNoShow) return
                        const next = PAY_CYCLE[(PAY_CYCLE.indexOf(p.payment_status) + 1) % PAY_CYCLE.length]
                        update.mutate({ id: p.id, payment_status: next })
                      }

                      return (
                        <tr
                          key={p.id}
                          onClick={() => canManage && openEdit(p)}
                          className={cn(
                            "border-b border-border transition-colors cursor-pointer group",
                            isNoShow ? "opacity-55" : "",
                            isTonight ? "bg-amber-50/50" : "hover:bg-muted/30",
                            isOutstanding ? "border-l-2 border-l-[#b5620a]" : "",
                          )}
                        >
                          {/* Date */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                            </div>
                            {isTonight && (
                              <div className="text-[9px] font-bold text-[#b5620a] uppercase tracking-wide mt-0.5">Tonight</div>
                            )}
                          </td>
                          {/* Event */}
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-foreground truncate max-w-[120px]">{p.event_name}</div>
                            {(p.event_type === "tet" || p.event_type === "new_year") && (
                              <span className="text-[9px] font-semibold text-purple-600 bg-purple-50 border border-purple-200 rounded px-1">Tết</span>
                            )}
                          </td>
                          {/* DJ */}
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-foreground">{p.dj_name}</div>
                            {isOwnerDJ(p.dj_name) ? (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-[#b5620a] border-amber-200">
                                👑 Owner
                              </span>
                            ) : (
                              <span className={cn(
                                "text-[9px] font-semibold px-1.5 py-0.5 rounded border",
                                p.dj_type === "foreigner"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                              )}>
                                {p.dj_type === "foreigner" ? "✈ Foreigner" : "🇻🇳 Local"}
                              </span>
                            )}
                          </td>
                          {/* Set time */}
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {formatTimeRange(p.set_start, p.set_end)}
                          </td>
                          {/* Duration */}
                          <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                            {p.duration_hours != null ? `${p.duration_hours}h` : "—"}
                          </td>
                          {/* Rate / multiplier */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {p.multiplier > 1 ? (
                              <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">{p.multiplier}×</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">1×</span>
                            )}
                          </td>
                          {/* Status — click to cycle */}
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={cycleStatus}
                              title="Click to change status"
                              className={cn(canManage ? "hover:opacity-70 cursor-pointer" : "cursor-default")}
                            >
                              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                            </button>
                          </td>
                          {/* Payment — click to cycle */}
                          <td className="px-3 py-2.5">
                            {isNoShow ? (
                              <span className="text-[10px] text-muted-foreground">N/A</span>
                            ) : (
                              <button
                                type="button"
                                onClick={cyclePayment}
                                title="Click to change payment status"
                                className={cn(canManage ? "hover:opacity-70 cursor-pointer" : "cursor-default")}
                              >
                                <Badge variant={payCfg.variant}>{payCfg.label}</Badge>
                              </button>
                            )}
                          </td>
                          {/* Amount */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {isNoShow ? (
                              <span className="text-[11px] text-muted-foreground/40">—</span>
                            ) : (
                              <span className={cn(
                                "font-mono text-[11px] font-medium",
                                p.payment_status === "paid" ? "text-green-700" :
                                p.payment_status === "unpaid" ? "text-[#b5620a]" :
                                "text-muted-foreground"
                              )}>
                                {formatVndAmount(p.amount_vnd)}
                              </span>
                            )}
                          </td>
                          {/* Payer */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {isOwnerDJ(p.dj_name) ? (
                              <span className="text-[11px] font-medium text-[#b5620a]">Owner</span>
                            ) : payerCfg ? (
                              <span className={cn("text-[11px] font-medium", payerCfg.cls)}>{payerCfg.label}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          {/* Receipt */}
                          <td className="px-3 py-2.5 text-center">
                            {isNoShow ? (
                              <span className="text-muted-foreground/30">—</span>
                            ) : p.receipt_uploaded ? (
                              <span className="text-green-600 text-xs font-bold">✓</span>
                            ) : (
                              <span className="text-red-500 text-xs">✗</span>
                            )}
                          </td>
                          {/* Notes */}
                          <td className="px-3 py-2.5 max-w-[140px]">
                            <span className="text-[10px] text-muted-foreground truncate block">{p.notes || "—"}</span>
                          </td>
                          {/* Edit hint */}
                          <td className="px-3 py-2.5">
                            {canManage && (
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    }) : []),
                  ]
                })}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {Array.from(grouped.entries()).map(([monthKey, rows]) => {
                const isExpanded = !expandedMonths.has(monthKey)
                const monthPaid = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + (r.amount_vnd ?? 0), 0)
                const monthOut = rows.filter((r) => r.payment_status === "unpaid" && r.status !== "no_show").reduce((s, r) => s + (r.amount_vnd ?? 0), 0)

                return (
                  <div key={`m-${monthKey}`}>
                    {/* Month header — sticky */}
                    <button
                      type="button"
                      onClick={() => toggleMonth(monthKey)}
                      className="sticky top-0 z-10 flex w-full flex-wrap items-center gap-2 bg-muted/50 backdrop-blur-sm px-3 py-1.5 text-left border-b border-border"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{monthLabel(monthKey)}</span>
                      <span className="rounded-full bg-border/60 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{rows.length}</span>
                      {monthPaid > 0 && <span className="text-[10px] text-green-700 tabular-nums whitespace-nowrap">Paid: {formatVndAmount(monthPaid)} ₫</span>}
                      {monthOut > 0 && <span className="text-[10px] text-[#b5620a] tabular-nums whitespace-nowrap">Outstanding: {formatVndAmount(monthOut)} ₫</span>}
                    </button>

                    {/* Cards */}
                    {isExpanded && rows.map((p) => {
                      const isTonight = p.date === todayIso
                      const isOutstanding = p.payment_status === "unpaid" && p.status === "done"
                      const isNoShow = p.status === "no_show"
                      const statusCfg = DJ_STATUS_CONFIG[p.status as keyof typeof DJ_STATUS_CONFIG]
                        ?? { label: p.status, variant: "neutral" as BadgeVariant }
                      const payCfg = DJ_PAY_CONFIG[p.payment_status as keyof typeof DJ_PAY_CONFIG]
                        ?? { label: p.payment_status, variant: "neutral" as BadgeVariant }
                      const payerCfg = p.payer_type ? (DJ_PAYER_CONFIG[p.payer_type as keyof typeof DJ_PAYER_CONFIG] ?? null) : null

                      const STATUS_CYCLE: DJPayment["status"][] = ["scheduled", "done", "no_show"]
                      const PAY_CYCLE: DJPayment["payment_status"][] = ["unpaid", "paid", "na"]

                      function cycleStatus(e: React.MouseEvent) {
                        e.stopPropagation()
                        if (!canManage) return
                        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status) + 1) % STATUS_CYCLE.length]
                        update.mutate({ id: p.id, status: next })
                      }

                      function cyclePayment(e: React.MouseEvent) {
                        e.stopPropagation()
                        if (!canManage || isNoShow) return
                        const next = PAY_CYCLE[(PAY_CYCLE.indexOf(p.payment_status) + 1) % PAY_CYCLE.length]
                        update.mutate({ id: p.id, payment_status: next })
                      }

                      return (
                        <div
                          key={p.id}
                          onClick={() => canManage && openEdit(p)}
                          className={cn(
                            "px-3 py-2 transition-colors",
                            isNoShow ? "opacity-55" : "",
                            isTonight ? "bg-amber-50/50" : "",
                            isOutstanding ? "border-l-2 border-l-[#b5620a]" : "",
                          )}
                        >
                          {/* Row 1: event name + amount */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <span className="font-medium text-[13px] text-foreground truncate">{p.event_name}</span>
                              {isTonight && <span className="text-[9px] font-bold text-[#b5620a] uppercase tracking-wide shrink-0">Tonight</span>}
                            </div>
                            {isNoShow ? (
                              <span className="text-[11px] text-muted-foreground/40 whitespace-nowrap tabular-nums shrink-0">—</span>
                            ) : (
                              <span className={cn(
                                "font-mono text-[12px] font-semibold whitespace-nowrap tabular-nums shrink-0",
                                p.payment_status === "paid" ? "text-green-700" :
                                p.payment_status === "unpaid" ? "text-[#b5620a]" :
                                "text-muted-foreground"
                              )}>
                                {formatVndAmount(p.amount_vnd)} ₫
                              </span>
                            )}
                          </div>

                          {/* Row 2: DJ + badges */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-foreground">{p.dj_name}</span>
                            {isOwnerDJ(p.dj_name) ? (
                              <span className="text-[9px] font-semibold px-1.5 py-px rounded border bg-amber-50 text-[#b5620a] border-amber-200">Owner</span>
                            ) : payerCfg ? (
                              <span className={cn("text-[10px] font-medium", payerCfg.cls)}>{payerCfg.label}</span>
                            ) : null}
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={cycleStatus}
                                title="Click to change status"
                                className={cn(canManage ? "hover:opacity-70 cursor-pointer" : "cursor-default")}
                              >
                                <Badge variant={statusCfg.variant} className="text-[9px] px-1.5 py-px">{statusCfg.label}</Badge>
                              </button>
                              {isNoShow ? (
                                <span className="text-[10px] text-muted-foreground">N/A</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={cyclePayment}
                                  title="Click to change payment status"
                                  className={cn(canManage ? "hover:opacity-70 cursor-pointer" : "cursor-default")}
                                >
                                  <Badge variant={payCfg.variant} className="text-[9px] px-1.5 py-px">{payCfg.label}</Badge>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] text-muted-foreground">Showing {filtered.length} of {payments.length} sets</span>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-muted-foreground">
                  Paid: <span className="font-mono font-semibold text-green-700">{formatVndAmount(filteredPaid)} ₫</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Outstanding: <span className="font-mono font-semibold text-[#b5620a]">{formatVndAmount(filteredOutstanding)} ₫</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <DJPaymentSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditing(null) }}
        payment={editing}
        key={editing?.id ?? "new-dj"}
      />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = "procurement" | "maintenance" | "dj_payments" | "purchase_request" | "payment_request" | "inventory"

export function Wishlist() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = profile?.role === "owner" || profile?.role === "manager"
  const [activeTab, setActiveTab] = useState<Tab>("procurement")

  const tabCls = (t: Tab) => cn(
    "flex items-center gap-1 px-3 py-2.5 text-xs sm:text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
    activeTab === t
      ? "border-[#78350F] text-[#1F2937]"
      : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
  )

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-[28px] font-bold leading-tight text-foreground">Operations</h1>
          <p className="hidden sm:block mt-1 text-sm text-muted-foreground">Daily ops workspace: purchasing, maintenance, DJ payouts, and live sheet trackers.</p>
        </div>
      </div>

      {/* Tabs — overflow-x-auto so all tabs are reachable on mobile */}
      <div className="overflow-x-auto shrink-0 border-b border-border">
        <div className="flex items-center gap-0 min-w-max">
          <button type="button" onClick={() => setActiveTab("procurement")} className={tabCls("procurement")}>
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Wishlist</span>
            <span className="hidden sm:inline">Purchase Wishlist</span>
          </button>
          <button type="button" onClick={() => setActiveTab("maintenance")} className={tabCls("maintenance")}>
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Maintenance</span>
            <span className="hidden sm:inline">Maintenance & Fixes</span>
          </button>
          <button type="button" onClick={() => setActiveTab("dj_payments")} className={tabCls("dj_payments")}>
            <Music2 className="h-3.5 w-3.5 shrink-0" />
            <span>DJ Pay</span>
          </button>
          <button type="button" onClick={() => setActiveTab("purchase_request")} className={cn(tabCls("purchase_request"), "hidden sm:flex")}>
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>Purchase Request</span>
          </button>
          <button type="button" onClick={() => setActiveTab("payment_request")} className={cn(tabCls("payment_request"), "hidden sm:flex")}>
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span>Payment Request</span>
          </button>
          <button type="button" onClick={() => setActiveTab("inventory")} className={cn(tabCls("inventory"), "hidden sm:flex")}>
            <Boxes className="h-3.5 w-3.5 shrink-0" />
            <span>Inventory</span>
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "procurement" ? (
        <ProcurementTab canManage={canManage} />
      ) : activeTab === "maintenance" ? (
        <MaintenanceTab canManage={canManage} />
      ) : activeTab === "dj_payments" ? (
        <DJPaymentsTab canManage={canManage} />
      ) : activeTab === "purchase_request" ? (
        <div className="flex flex-col gap-3">
          <RequestOverviewPanel kind="purchase_request" />
          <SheetEmbedTab
            kind="purchase_request"
            title="Purchase Request"
            description="Live Google Sheet for formal purchase requests (PR). Paste your published sheet link and everyone sees real-time updates."
            canManage={canManage}
            fullView
          />
        </div>
      ) : activeTab === "payment_request" ? (
        <div className="flex flex-col gap-3">
          <RequestOverviewPanel kind="payment_request" />
          <SheetEmbedTab
            kind="payment_request"
            title="Payment Request"
            description="Queue of supplier / vendor payments pending release. Backed by a Google Sheet the finance team can edit directly."
            canManage={canManage}
            fullView
          />
        </div>
      ) : (
        <SheetEmbedTab
          kind="inventory"
          title="Inventory"
          description="Current stock levels and reorder status. Connect the inventory sheet maintained by the bar or kitchen team."
          canManage={canManage}
        />
      )}
    </div>
  )
}

export default Wishlist
