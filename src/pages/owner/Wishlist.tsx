import { useState, useMemo } from "react"
import { Trash2, Plus, Pencil, Wrench, ShoppingCart, Music2, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react"
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

const CATEGORIES: Array<{ value: MaintenanceCategory | "all"; label: string }> = [
  { value: "all",        label: "All Categories" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing",   label: "Plumbing" },
  { value: "structural", label: "Structural" },
  { value: "equipment",  label: "Equipment" },
  { value: "aesthetic",  label: "Aesthetic" },
  { value: "safety",     label: "Safety" },
  { value: "other",      label: "Other" },
]

const PRIORITIES: Array<{ value: WishlistPriority | "all"; label: string }> = [
  { value: "all",    label: "All Priorities" },
  { value: "high",   label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low",    label: "Low" },
]


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
      <SheetContent side="right" className="sm:max-w-[440px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit Item" : "Add Item"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Item Name *</label>
            <input
              type="text"
              className="form-input-base"
              placeholder="e.g. Cocktail Shakers (set of 6)"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">Total Cost</label>
              <div className="form-input-base bg-secondary/50 text-muted-foreground select-none text-sm tabular-nums">
                {draft.estimatedCost != null
                  ? new Intl.NumberFormat("vi-VN").format(draft.quantity * draft.estimatedCost) + " ₫"
                  : "—"}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1.5">Priority</label>
            <div className="flex gap-1.5">
              {(["high", "medium", "low"] as WishlistPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, priority: p }))}
                  className={cn(
                    "rounded-sm border px-3 py-0.5 text-[10px] tracking-wide uppercase transition-all",
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
                    "rounded-sm border px-3 py-0.5 text-[10px] tracking-wide transition-all",
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

        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-auto px-4 py-2 text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="h-auto px-4 py-2 text-xs">
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
      <SheetContent side="right" className="sm:max-w-[440px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit Task" : "Log Maintenance Task"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              autoFocus
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

        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-auto px-4 py-2 text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="h-auto px-4 py-2 text-xs">
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
  request:   { label: "Requested",  accent: "#6b7280", sectionBg: "rgba(107,114,128,0.06)", badgeBg: "#f3f4f6", borderTop: "#6b7280" },
  approved:  { label: "Approved",   accent: "#3b82f6", sectionBg: "rgba(59,130,246,0.06)",  badgeBg: "#dbeafe", borderTop: "#3b82f6" },
  ordered:   { label: "Ordered",    accent: "#f59e0b", sectionBg: "rgba(245,158,11,0.06)",  badgeBg: "#fef3c7", borderTop: "#f59e0b" },
  delivered: { label: "Delivered",  accent: "#10b981", sectionBg: "rgba(16,185,129,0.06)",  badgeBg: "#d1fae5", borderTop: "#10b981" },
}

const STATUS_ORDER: WishlistStatus[] = ["request", "approved", "ordered", "delivered"]

// ─── Procurement tab ───────────────────────────────────────────────────────────

function ProcurementTab({ canManage }: { canManage: boolean }) {
  const [priorityFilter, setPriorityFilter] = useState<WishlistPriority | "all">("all")
  const [collapsedSections, setCollapsedSections] = useState<Set<WishlistStatus>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)

  const { data: items = [], isLoading } = useWishlistItems()
  const deleteItem = useDeleteWishlistItem()

  const filtered = useMemo(() => items.filter((item) => {
    if (priorityFilter !== "all" && item.priority !== priorityFilter) return false
    return true
  }), [items, priorityFilter])

  const grouped = useMemo(() =>
    STATUS_ORDER.reduce<Record<WishlistStatus, WishlistItem[]>>((acc, s) => {
      acc[s] = filtered.filter((i) => i.status === s)
      return acc
    }, {} as Record<WishlistStatus, WishlistItem[]>),
    [filtered]
  )

  const totalPendingSpend = useMemo(() =>
    filtered.filter((i) => i.status !== "delivered").reduce((s, i) => s + (i.estimatedCost ?? 0) * i.quantity, 0),
    [filtered]
  )

  function openAdd() { setEditingItem(null); setSheetOpen(true) }
  function openEdit(item: WishlistItem) { setEditingItem(item); setSheetOpen(true) }
  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return
    await deleteItem.mutateAsync(id)
  }
  function toggleSection(s: WishlistStatus) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {/* Priority pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] tracking-widest text-muted-foreground uppercase font-semibold mr-1">Priority</span>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriorityFilter(p.value as any)}
              className={cn(
                "rounded-full px-[14px] py-[6px] text-[13px] font-medium transition-all",
                priorityFilter === p.value
                  ? "bg-[#78350F] text-white"
                  : "bg-white border border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={openAdd}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            + Add Item
          </Button>
        )}
      </div>

      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center gap-4 shrink-0 flex-wrap">
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_SECTION[s]
            const count = grouped[s].length
            const sectionSpend = grouped[s].reduce((sum, i) => sum + (i.estimatedCost ?? 0) * i.quantity, 0)
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: cfg.accent }} />
                <span className="text-[10px] font-semibold" style={{ color: cfg.accent }}>{cfg.label}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: cfg.badgeBg, color: cfg.accent }}>{count}</span>
                {sectionSpend > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">{formatVnd(sectionSpend)}</span>
                )}
              </div>
            )
          })}
          <div className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            Pending spend: <span className="font-semibold text-foreground">{formatVnd(totalPendingSpend)}</span>
          </div>
        </div>
      )}

      {/* Status-grouped sections */}
      <div className="flex-1 overflow-auto space-y-3">
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
          STATUS_ORDER.map((status) => {
            const cfg = STATUS_SECTION[status]
            const sectionItems = grouped[status]
            const isCollapsed = collapsedSections.has(status)
            const sectionSpend = sectionItems.reduce((sum, i) => sum + (i.estimatedCost ?? 0) * i.quantity, 0)

            return (
              <div key={status} className="rounded-card border border-border overflow-hidden shadow-card">
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(status)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border transition-colors hover:bg-secondary/30"
                  style={{ background: cfg.sectionBg, borderTop: `2px solid ${cfg.accent}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cfg.accent }} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{cfg.label}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280]">
                      {sectionItems.length}
                    </span>
                    {sectionSpend > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums ml-1">{formatVnd(sectionSpend)}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">{isCollapsed ? "▸" : "▾"}</span>
                </button>

                {/* Section rows */}
                {!isCollapsed && (
                  <>
                    {sectionItems.length === 0 ? (
                      <div className="px-4 py-4 text-center text-[11px] text-muted-foreground">No items in this stage</div>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Column headers */}
                        <div className="grid grid-cols-[minmax(100px,1fr)_50px_120px_90px_36px] sm:grid-cols-[minmax(100px,1fr)_50px_130px_100px_1fr_36px] items-center px-4 py-2 bg-secondary/20 min-w-0">
                          {["ITEM", "QTY", "EST. COST", "PRIORITY", "NOTES", ""].map((h, i) => (
                            <div key={h || i} className={cn("text-[9.5px] tracking-widest font-semibold text-muted-foreground uppercase", h === "NOTES" && "hidden sm:block")}>{h}</div>
                          ))}
                        </div>
                        {sectionItems.map((item) => {
                          const pri = PRIORITY_BADGE[item.priority]
                          const totalCost = (item.estimatedCost ?? 0) * item.quantity
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[minmax(100px,1fr)_50px_120px_90px_36px] sm:grid-cols-[minmax(100px,1fr)_50px_130px_100px_1fr_36px] items-center px-4 py-2.5 border-t border-border/50 hover:bg-secondary/20 transition-colors group"
                              style={{ borderLeft: `3px solid ${cfg.accent}33` }}
                            >
                              <button
                                type="button"
                                onClick={() => canManage && openEdit(item)}
                                className={cn("text-sm text-left font-medium text-foreground truncate min-w-[100px]", canManage && "hover:text-primary transition-colors")}
                              >
                                {item.title}
                              </button>
                              <div className="text-sm text-foreground">{item.quantity}</div>
                              <div className="text-sm text-foreground tabular-nums">{formatVnd(totalCost || item.estimatedCost)}</div>
                              <div>
                                <Badge variant={pri.variant}>{pri.label}</Badge>
                              </div>
                              <div className="hidden sm:block text-xs text-muted-foreground truncate pr-2">{item.notes || "—"}</div>
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canManage && (
                                  <>
                                    <button type="button" onClick={() => openEdit(item)} className="rounded-sm p-1 text-muted-foreground hover:text-foreground transition-colors">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(item.id)} className="rounded-sm p-1 text-muted-foreground hover:text-error transition-colors">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

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

function MaintenanceTab({ canManage }: { canManage: boolean }) {
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory | "all">("all")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null)

  const { data: tasks = [], isLoading } = useMaintenanceTasks()
  const deleteTask = useDeleteMaintenanceTask()
  const updateTask = useUpdateMaintenanceTask()

  const filtered = useMemo(() => tasks.filter((t) => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false
    return true
  }), [tasks, priorityFilter, categoryFilter])

  const columns: MaintenanceStatus[] = ["open", "in_progress", "done"]

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

  const openCount = filtered.filter((t) => t.status === "open").length
  const inProgressCount = filtered.filter((t) => t.status === "in_progress").length

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="rounded-sm border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:bg-secondary transition-colors"
          >
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="rounded-sm border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:bg-secondary transition-colors"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {(openCount > 0 || inProgressCount > 0) && (
            <span className="text-[10px] text-muted-foreground">
              {openCount} open · {inProgressCount} in progress
            </span>
          )}
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={openAdd}
            className="h-auto px-3 py-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Task
          </Button>
        )}
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-auto">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col)
            const cfg = MAINT_STATUS_CONFIG[col]
            return (
              <div key={col} className="flex flex-col gap-2 min-h-0">
                {/* Column header */}
                <div className={cn("rounded-t-card rounded-b-sm border border-border bg-card px-3 py-2 border-t-2", cfg.col)}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-widest font-semibold text-muted-foreground uppercase">{cfg.label}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{colTasks.length}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                  {colTasks.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const pri = MAINT_PRIORITY_BADGE[task.priority]
                      return (
                        <div
                          key={task.id}
                          className="rounded-sm border border-border bg-card px-3 py-2.5 shadow-sm hover:shadow-md transition-shadow group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <button
                              type="button"
                              onClick={() => canManage && openEdit(task)}
                              className={cn("text-sm font-medium text-foreground text-left leading-snug", canManage && "hover:text-primary transition-colors")}
                            >
                              {task.title}
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canManage && (
                                <>
                                  <button type="button" onClick={() => openEdit(task)} className="rounded-sm p-1 text-muted-foreground hover:text-foreground transition-colors">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => handleDelete(task.id)} className="rounded-sm p-1 text-muted-foreground hover:text-error transition-colors">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <Badge variant={pri.variant}>{pri.label}</Badge>
                            <Badge variant="neutral">{CATEGORY_LABELS[task.category]}</Badge>
                          </div>

                          {task.location && (
                            <div className="text-[11px] text-muted-foreground mb-1">📍 {task.location}</div>
                          )}
                          {task.description && (
                            <div className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{task.description}</div>
                          )}

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {task.estimatedCost != null ? formatVnd(task.estimatedCost) : "No estimate"}
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => cycleStatus(task)}
                                className="text-[9px] tracking-wide text-primary hover:underline transition-colors"
                              >
                                {col === "open" ? "→ In Progress" : col === "in_progress" ? "→ Done" : "↺ Reopen"}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
      <SheetContent side="right" className="sm:max-w-[420px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? "Edit DJ Set" : "Add DJ Set"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
            <input type="text" className={inputCls} placeholder="e.g. SaturPlay" value={draft.event_name} onChange={(e) => set("event_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest font-medium text-muted-foreground uppercase block mb-1">DJ Name *</label>
              <input type="text" className={inputCls} placeholder="e.g. CharleS" value={draft.dj_name} onChange={(e) => set("dj_name", e.target.value)} />
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

        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-auto px-4 py-1.5 text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="h-auto px-4 py-1.5 text-xs">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Set"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
    <div className="flex flex-col gap-4 flex-1 min-h-0">

      {/* Sync bar */}
      <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-2.5 shrink-0 shadow-card flex-wrap">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          Source: <span className="font-medium text-foreground">HQ Calendar (Google Sheets)</span>
          <span className="mx-1.5 opacity-30">·</span>Jan 1 – Today
        </span>
        {syncMsg && (
          <span className="text-[10px] text-muted-foreground border border-border rounded px-2 py-0.5">{syncMsg}</span>
        )}
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="ml-auto flex items-center gap-1.5 rounded border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        {[
          { label: "Total Sets", value: stats.totalSets, sub: "Jan 1 – Today" },
          { label: "Unique DJs", value: stats.uniqueDJs, sub: "in this period" },
          { label: "Total Paid", value: `${formatVndAmount(stats.totalPaid)} ₫`, sub: "confirmed", accent: "green" },
          { label: "Outstanding", value: `${formatVndAmount(stats.outstanding)} ₫`, sub: "unpaid sets", accent: "amber" },
          { label: "No Shows", value: stats.noShows, sub: "no payment due" },
        ].map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-card border p-3 shadow-card",
              c.accent === "green" ? "border-green-200 bg-green-50" :
              c.accent === "amber" ? "border-amber-200 bg-amber-50" :
              "border-border bg-card"
            )}
          >
            <div className={cn(
              "text-[9px] font-bold uppercase tracking-widest mb-1",
              c.accent === "green" ? "text-green-700" :
              c.accent === "amber" ? "text-[#b5620a]" :
              "text-muted-foreground"
            )}>{c.label}</div>
            <div className={cn(
              "font-mono text-lg font-semibold leading-none",
              c.accent === "green" ? "text-green-700" :
              c.accent === "amber" ? "text-[#b5620a]" :
              "text-foreground"
            )}>{c.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Status */}
        <div className="flex items-center gap-1 rounded border border-border bg-card p-0.5">
          {(["all", "done", "scheduled", "no_show"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setStatusFilter(v)} className={filterBtnCls(statusFilter === v)}>
              {v === "all" ? "All" : v === "no_show" ? "No Show" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Payment */}
        <div className="flex items-center gap-1 rounded border border-border bg-card p-0.5">
          {(["all", "unpaid", "paid"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setPayFilter(v)} className={filterBtnCls(payFilter === v)}>
              {v === "all" ? "All Payment" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Payer */}
        <div className="flex items-center gap-1 rounded border border-border bg-card p-0.5">
          {(["all", "foreigner_charlie", "local_company"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setPayerFilter(v)} className={filterBtnCls(payerFilter === v)}>
              {v === "all" ? "All Payer" : v === "foreigner_charlie" ? "Charlie" : "Company"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} className="h-auto px-3 py-1 text-[10px] font-medium">
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
          {canManage && (
            <Button type="button" onClick={openAdd} className="h-auto px-3 py-1.5 text-[10px] font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Add DJ Set
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-card border border-border shadow-card">
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
            <table className="w-full border-collapse text-xs min-w-[900px]">
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

type Tab = "procurement" | "maintenance" | "dj_payments"

export function Wishlist() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = profile?.role === "owner" || profile?.role === "manager"
  const [activeTab, setActiveTab] = useState<Tab>("procurement")

  const tabCls = (t: Tab) => cn(
    "flex items-center gap-1.5 px-4 py-3 text-[14px] font-medium border-b-2 transition-colors -mb-px",
    activeTab === t
      ? "border-[#78350F] text-[#1F2937]"
      : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
  )

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Procurement wishlist, maintenance tracker & DJ payment management</p>
        </div>
      </div>

      {/* Tabs — overflow-x-auto so all 3 are reachable on mobile */}
      <div className="overflow-x-auto shrink-0 border-b border-border">
        <div className="flex items-center gap-0 min-w-max">
          <button type="button" onClick={() => setActiveTab("procurement")} className={tabCls("procurement")}>
            <ShoppingCart className="h-3.5 w-3.5" />
            Procurement Wishlist
          </button>
          <button type="button" onClick={() => setActiveTab("maintenance")} className={tabCls("maintenance")}>
            <Wrench className="h-3.5 w-3.5" />
            Maintenance & Fixes
          </button>
          <button type="button" onClick={() => setActiveTab("dj_payments")} className={tabCls("dj_payments")}>
            <Music2 className="h-3.5 w-3.5" />
            DJ Payments
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "procurement" ? (
        <ProcurementTab canManage={canManage} />
      ) : activeTab === "maintenance" ? (
        <MaintenanceTab canManage={canManage} />
      ) : (
        <DJPaymentsTab canManage={canManage} />
      )}
    </div>
  )
}

export default Wishlist
