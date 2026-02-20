import { useState, useMemo } from "react"
import { Trash2, Plus, Pencil, Wrench, ShoppingCart } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

// ─── Shared config ─────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<WishlistPriority, { label: string; cls: string }> = {
  high:   { label: "HIGH",   cls: "bg-[#ef4444]/15 text-[#991b1b] border-[#ef4444]/30" },
  medium: { label: "MEDIUM", cls: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30" },
  low:    { label: "LOW",    cls: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30" },
}

const STATUS_BADGE: Record<WishlistStatus, { label: string; cls: string }> = {
  request:   { label: "Request",   cls: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30" },
  approved:  { label: "Approved",  cls: "bg-[#3b82f6]/15 text-[#1e40af] border-[#3b82f6]/30" },
  ordered:   { label: "Ordered",   cls: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30" },
  delivered: { label: "Delivered", cls: "bg-[#10b981]/15 text-[#065f46] border-[#10b981]/30" },
}

const MAINT_STATUS_CONFIG: Record<MaintenanceStatus, { label: string; cls: string; col: string }> = {
  open:        { label: "Open",        cls: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30",   col: "border-t-[#6b7280]" },
  in_progress: { label: "In Progress", cls: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30",  col: "border-t-[#f59e0b]" },
  done:        { label: "Done",        cls: "bg-[#10b981]/15 text-[#065f46] border-[#10b981]/30",   col: "border-t-[#10b981]" },
}

const MAINT_PRIORITY_BADGE: Record<MaintenancePriority, { label: string; cls: string }> = {
  high:   { label: "HIGH",   cls: "bg-[#ef4444]/15 text-[#991b1b] border-[#ef4444]/30" },
  medium: { label: "MEDIUM", cls: "bg-[#f59e0b]/15 text-[#92400e] border-[#f59e0b]/30" },
  low:    { label: "LOW",    cls: "bg-[#6b7280]/15 text-[#374151] border-[#6b7280]/30" },
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
                    draft.priority === p ? PRIORITY_BADGE[p].cls + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
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
                    draft.status === s ? STATUS_BADGE[s].cls + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
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
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-sm border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending} className="rounded-sm bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
          </button>
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
                    draft.priority === p ? MAINT_PRIORITY_BADGE[p].cls + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
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
                    draft.status === s ? MAINT_STATUS_CONFIG[s].cls + " font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
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
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-sm border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending} className="rounded-sm bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Log Task"}
          </button>
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
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold mr-1">Priority</span>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriorityFilter(p.value as any)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-[10px] tracking-wide font-medium transition-all",
                priorityFilter === p.value
                  ? p.value === "all"
                    ? "border-foreground/30 bg-foreground/10 text-foreground"
                    : PRIORITY_BADGE[p.value as WishlistPriority]?.cls ?? "border-border bg-secondary text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
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
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>{cfg.label}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: cfg.badgeBg, color: cfg.accent }}>
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
                      <>
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_50px_130px_100px_1fr_36px] items-center px-4 py-2 bg-secondary/20">
                          {["ITEM", "QTY", "EST. COST", "PRIORITY", "NOTES", ""].map((h) => (
                            <div key={h} className="text-[9.5px] tracking-widest font-semibold text-muted-foreground uppercase">{h}</div>
                          ))}
                        </div>
                        {sectionItems.map((item) => {
                          const pri = PRIORITY_BADGE[item.priority]
                          const totalCost = (item.estimatedCost ?? 0) * item.quantity
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_50px_130px_100px_1fr_36px] items-center px-4 py-2.5 border-t border-border/50 hover:bg-secondary/20 transition-colors group"
                              style={{ borderLeft: `3px solid ${cfg.accent}33` }}
                            >
                              <button
                                type="button"
                                onClick={() => canManage && openEdit(item)}
                                className={cn("text-sm text-left font-medium text-foreground truncate", canManage && "hover:text-primary transition-colors")}
                              >
                                {item.title}
                              </button>
                              <div className="text-sm text-foreground">{item.quantity}</div>
                              <div className="text-sm text-foreground tabular-nums">{formatVnd(totalCost || item.estimatedCost)}</div>
                              <div>
                                <span className={cn("rounded-sm border px-2 py-0.5 text-[9.5px] tracking-wide font-semibold uppercase", pri.cls)}>
                                  {pri.label}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate pr-2">{item.notes || "—"}</div>
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
                      </>
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
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Task
          </button>
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
                            <span className={cn("rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide font-semibold uppercase", pri.cls)}>
                              {pri.label}
                            </span>
                            <span className="rounded-sm border border-border bg-secondary/50 px-1.5 py-0.5 text-[9px] tracking-wide text-muted-foreground uppercase">
                              {CATEGORY_LABELS[task.category]}
                            </span>
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

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = "procurement" | "maintenance"

export function Wishlist() {
  const profile = useAuthStore((s) => s.profile)
  const canManage = profile?.role === "owner" || profile?.role === "manager"
  const [activeTab, setActiveTab] = useState<Tab>("procurement")

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Operations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Procurement wishlist & maintenance tracker</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("procurement")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
            activeTab === "procurement"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Procurement Wishlist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("maintenance")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
            activeTab === "maintenance"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          Maintenance & Fixes
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "procurement" ? (
        <ProcurementTab canManage={canManage} />
      ) : (
        <MaintenanceTab canManage={canManage} />
      )}
    </div>
  )
}

export default Wishlist
