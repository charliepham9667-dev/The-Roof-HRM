import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderOpen,
  Grid3x3,
  Link,
  Loader2,
  Plus,
  Presentation,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  UtensilsCrossed,
  Users,
  Video,
  X,
  AlertCircle,
} from 'lucide-react'
import { useResources, useCreateResource, useDeleteResource } from '../../hooks/useResources'
import type { ResourceLink, ResourceCategory } from '../../types'
import { cn } from '@/lib/utils'

// ─── Category config ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ResourceCategory, {
  label: string
  icon: React.ReactNode
  colorClass: string
  badgeClass: string
  accentColor: string
}> = {
  sop:      { label: 'SOPs',      icon: <ClipboardList className="h-3.5 w-3.5" />, colorClass: 'text-info',             badgeClass: 'border-info/20 bg-info/8 text-info',             accentColor: 'bg-info' },
  training: { label: 'Training',  icon: <BookOpen className="h-3.5 w-3.5" />,      colorClass: 'text-success',          badgeClass: 'border-success/20 bg-success/8 text-success',    accentColor: 'bg-success' },
  safety:   { label: 'Safety',    icon: <Shield className="h-3.5 w-3.5" />,         colorClass: 'text-error',            badgeClass: 'border-error/20 bg-error/8 text-error',          accentColor: 'bg-error' },
  branding: { label: 'Branding',  icon: <Sparkles className="h-3.5 w-3.5" />,       colorClass: 'text-purple-400',       badgeClass: 'border-purple-400/20 bg-purple-400/8 text-purple-400', accentColor: 'bg-purple-400' },
  hr:       { label: 'HR',        icon: <Users className="h-3.5 w-3.5" />,          colorClass: 'text-warning',          badgeClass: 'border-warning/20 bg-warning/8 text-warning',    accentColor: 'bg-warning' },
  menu:     { label: 'Menu',      icon: <UtensilsCrossed className="h-3.5 w-3.5" />, colorClass: 'text-primary',         badgeClass: 'border-primary/20 bg-primary/8 text-primary',    accentColor: 'bg-primary' },
  recipes:  { label: 'Recipes',   icon: <FlaskConical className="h-3.5 w-3.5" />,   colorClass: 'text-teal-500',         badgeClass: 'border-teal-500/20 bg-teal-500/8 text-teal-500', accentColor: 'bg-teal-500' },
  licenses: { label: 'Licenses',  icon: <ScrollText className="h-3.5 w-3.5" />,     colorClass: 'text-cyan-400',         badgeClass: 'border-cyan-400/20 bg-cyan-400/8 text-cyan-400', accentColor: 'bg-cyan-400' },
  other:    { label: 'Other',     icon: <Briefcase className="h-3.5 w-3.5" />,       colorClass: 'text-muted-foreground', badgeClass: 'border-border bg-secondary text-muted-foreground', accentColor: 'bg-border' },
}

// ─── File type config ────────────────────────────────────────────────────────

type FileType = 'pdf' | 'doc' | 'sheet' | 'slide' | 'video' | 'link' | 'other'

const FILE_CONFIG: Record<FileType, {
  label: string
  icon: React.ReactNode
  bgClass: string
  badgeClass: string
}> = {
  pdf:   { label: 'PDF',    icon: <FileText className="h-3.5 w-3.5" />,        bgClass: 'bg-error/10 text-error',    badgeClass: 'border-error/20 bg-error/8 text-error' },
  doc:   { label: 'Doc',    icon: <FileText className="h-3.5 w-3.5" />,        bgClass: 'bg-info/10 text-info',      badgeClass: 'border-info/20 bg-info/8 text-info' },
  sheet: { label: 'Sheet',  icon: <FileSpreadsheet className="h-3.5 w-3.5" />, bgClass: 'bg-success/10 text-success', badgeClass: 'border-success/20 bg-success/8 text-success' },
  slide: { label: 'Slides', icon: <Presentation className="h-3.5 w-3.5" />,    bgClass: 'bg-warning/10 text-warning', badgeClass: 'border-warning/20 bg-warning/8 text-warning' },
  video: { label: 'Video',  icon: <Video className="h-3.5 w-3.5" />,           bgClass: 'bg-purple-400/10 text-purple-400', badgeClass: 'border-purple-400/20 bg-purple-400/8 text-purple-400' },
  link:  { label: 'Link',   icon: <Link className="h-3.5 w-3.5" />,            bgClass: 'bg-primary/10 text-primary', badgeClass: 'border-primary/20 bg-primary/8 text-primary' },
  other: { label: 'File',   icon: <FileText className="h-3.5 w-3.5" />,        bgClass: 'bg-secondary text-muted-foreground', badgeClass: 'border-border bg-secondary text-muted-foreground' },
}

function getFileType(resource: ResourceLink): FileType {
  const url = (resource.url || '').toLowerCase()
  const icon = (resource.icon || '').toLowerCase()
  const sub = (resource.subcategory || '').toLowerCase()
  if (icon.includes('pdf') || sub.includes('pdf') || url.includes('.pdf')) return 'pdf'
  if (icon.includes('sheet') || sub.includes('sheet') || url.includes('spreadsheet')) return 'sheet'
  if (icon.includes('slide') || sub.includes('slide') || url.includes('presentation')) return 'slide'
  if (icon.includes('video') || sub.includes('video')) return 'video'
  if (icon.includes('link') || (!url.includes('google.com') && url.startsWith('http'))) return 'link'
  if (icon.includes('doc') || sub.includes('doc') || url.includes('document')) return 'doc'
  return 'other'
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Resources() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<FileType | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [detailResource, setDetailResource] = useState<ResourceLink | null>(null)

  const { data: resources = [], isLoading } = useResources()

  const filtered = resources.filter((r) => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
    if (typeFilter !== 'all' && getFileType(r) !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.title.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const countFor = (cat: ResourceCategory | 'all') =>
    cat === 'all' ? resources.length : resources.filter((r) => r.category === cat).length

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">Resource Library</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">SOPs, training materials & documents — linked to Google Drive</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 px-3 text-xs shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* ── Category chips — horizontal scroll ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <CategoryChip
          icon={<Grid3x3 className="h-3 w-3" />}
          label="All"
          count={countFor('all')}
          active={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        />
        {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map((cat) => (
          <CategoryChip
            key={cat}
            icon={CATEGORY_CONFIG[cat].icon}
            label={CATEGORY_CONFIG[cat].label}
            count={countFor(cat)}
            active={categoryFilter === cat}
            colorClass={categoryFilter === cat ? CATEGORY_CONFIG[cat].colorClass : ''}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
          />
        ))}
      </div>

      {/* ── Search + file type filter row ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
        </div>
        {/* File type pills — horizontal scroll */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none shrink-0">
          {(['all', 'pdf', 'doc', 'sheet', 'slide', 'video', 'link'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] tracking-wide uppercase transition-colors',
                typeFilter === t
                  ? 'bg-foreground border-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'all' ? 'All' : (
                <>
                  {FILE_CONFIG[t].icon}
                  {FILE_CONFIG[t].label}
                </>
              )}
            </button>
          ))}
        </div>
        <span className="hidden sm:block text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Resource list ── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-card border border-border bg-card p-3 shadow-card flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm text-muted-foreground">No resources found</div>
          <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-primary hover:underline">
            Add a resource
          </button>
        </div>
      ) : (
        <>
          <div className="text-[10px] text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''} · tap to open</div>
          {/* Mobile: compact list */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden sm:hidden">
            {filtered.map((r, i) => (
              <ResourceRow
                key={r.id}
                resource={r}
                isLast={i === filtered.length - 1}
                onOpen={() => setDetailResource(r)}
              />
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <ResourceCard key={r.id} resource={r} onOpen={() => setDetailResource(r)} />
            ))}
          </div>
        </>
      )}

      {/* ── Detail modal ── */}
      {detailResource && (
        <DetailModal resource={detailResource} onClose={() => setDetailResource(null)} />
      )}

      {/* ── Add modal ── */}
      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}

// ─── Category chip (compact) ─────────────────────────────────────────────────

function CategoryChip({
  icon, label, count, active, colorClass = '', onClick,
}: { icon: React.ReactNode; label: string; count: number; active: boolean; colorClass?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all',
        active
          ? 'border-foreground/20 bg-foreground/[0.07] shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80',
      )}
    >
      <span className={cn("leading-none", active ? colorClass : "")}>{icon}</span>
      <span className={cn(active ? 'text-foreground' : '')}>{label}</span>
      <span className={cn(
        'rounded-full px-1.5 py-px text-[9px] leading-none font-bold',
        active ? 'bg-foreground/10 text-foreground' : 'bg-secondary text-muted-foreground',
      )}>
        {count}
      </span>
    </button>
  )
}

// ─── Resource row (mobile) ────────────────────────────────────────────────────

function ResourceRow({ resource, isLast, onOpen }: { resource: ResourceLink; isLast: boolean; onOpen: () => void }) {
  const deleteResource = useDeleteResource()
  const cat = CATEGORY_CONFIG[resource.category]
  const ft = FILE_CONFIG[getFileType(resource)]

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-secondary/50 transition-colors",
        !isLast && "border-b border-border/60"
      )}
      onClick={onOpen}
    >
      {/* File type icon */}
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ft.bgClass)}>
        {ft.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground leading-snug truncate">{resource.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('rounded-sm border px-1.5 py-px text-[9px] tracking-wide uppercase leading-none', cat.badgeClass)}>
            {cat.label}
          </span>
          <span className={cn('rounded-sm border px-1.5 py-px text-[9px] tracking-wide uppercase leading-none', ft.badgeClass)}>
            {ft.label}
          </span>
          {resource.description && (
            <span className="text-[10px] text-muted-foreground truncate hidden xs:inline">{resource.description}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded p-1.5 text-muted-foreground hover:text-primary transition-colors"
          title="Open in Drive"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); deleteResource.mutate(resource.id) }}
          className="rounded p-1.5 text-muted-foreground/40 hover:text-error hover:bg-error/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Resource card (desktop) ──────────────────────────────────────────────────

function ResourceCard({ resource, onOpen }: { resource: ResourceLink; onOpen: () => void }) {
  const deleteResource = useDeleteResource()
  const cat = CATEGORY_CONFIG[resource.category]
  const ft = FILE_CONFIG[getFileType(resource)]

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col gap-2.5 rounded-card border border-border bg-card p-4 shadow-card cursor-pointer transition-all hover:shadow-md hover:-translate-y-px hover:border-border/80 overflow-hidden"
    >
      {/* Top accent */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity', cat.accentColor)} />

      {/* Top row: file icon + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ft.bgClass)}>
          {ft.icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase leading-none', cat.badgeClass)}>
            {cat.label}
          </span>
          <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase leading-none', ft.badgeClass)}>
            {ft.label}
          </span>
        </div>
      </div>

      <div className="text-sm font-medium text-foreground leading-snug">{resource.title}</div>

      {resource.description && (
        <div className="text-xs text-secondary-foreground leading-relaxed line-clamp-2">{resource.description}</div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[10px] tracking-wide text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase">
          Open ↗
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); deleteResource.mutate(resource.id) }}
          className="rounded p-1 text-muted-foreground/40 hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ resource, onClose }: { resource: ResourceLink; onClose: () => void }) {
  const cat = CATEGORY_CONFIG[resource.category]
  const ft = FILE_CONFIG[getFileType(resource)]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-card border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', ft.bgClass)}>
            {ft.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase', cat.badgeClass)}>{cat.label}</span>
              <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase', ft.badgeClass)}>{ft.label}</span>
            </div>
            <div className="text-base font-semibold text-foreground leading-snug">{resource.title}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {resource.description && (
            <div>
              <div className="text-[9px] tracking-[2px] text-muted-foreground uppercase mb-1.5">Description</div>
              <div className="text-sm text-secondary-foreground leading-relaxed">{resource.description}</div>
            </div>
          )}

          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 transition-all hover:border-border/80 hover:shadow-card"
          >
            <span className="text-xl">🗂️</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{resource.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Google Drive · tap to open</div>
            </div>
            <ExternalLink className="h-4 w-4 text-primary shrink-0" />
          </a>

          {resource.subcategory && (
            <div>
              <div className="text-[9px] tracking-[2px] text-muted-foreground uppercase mb-1.5">Tag</div>
              <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {resource.subcategory}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            Close
          </button>
          <Button asChild size="sm" className="h-8 px-4 text-xs">
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Open in Drive
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function AddModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    category: 'sop' as ResourceCategory,
    subcategory: '',
  })
  const [error, setError] = useState<string | null>(null)
  const createResource = useCreateResource()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formData.title.trim()) { setError('Title is required'); return }
    if (!formData.url.trim()) { setError('URL is required'); return }
    try {
      await createResource.mutateAsync(formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create resource')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-card border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plus className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-foreground">Add Resource</div>
            <div className="text-xs text-muted-foreground">Link a Google Drive document</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-3">
            <Field label="Title">
              <input
                className="form-input-base"
                placeholder="e.g. Opening Checklist SOP"
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  className="form-input-base"
                  value={formData.category}
                  onChange={(e) => setFormData(f => ({ ...f, category: e.target.value as ResourceCategory }))}
                >
                  {(Object.entries(CATEGORY_CONFIG) as [ResourceCategory, typeof CATEGORY_CONFIG[ResourceCategory]][]).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tag">
                <input
                  className="form-input-base"
                  placeholder="e.g. Bar SOPs"
                  value={formData.subcategory}
                  onChange={(e) => setFormData(f => ({ ...f, subcategory: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Description (optional)">
              <textarea
                className="form-input-base resize-none"
                rows={2}
                placeholder="Brief description…"
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <Field label="Google Drive Link">
              <input
                type="url"
                className="form-input-base"
                placeholder="https://drive.google.com/..."
                value={formData.url}
                onChange={(e) => setFormData(f => ({ ...f, url: e.target.value }))}
              />
            </Field>

            {error && (
              <div className="flex items-center gap-2 text-xs text-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30">
            <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Cancel
            </button>
            <Button type="submit" size="sm" disabled={createResource.isPending} className="h-8 px-4 text-xs">
              {createResource.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Resource
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] tracking-[2px] text-muted-foreground uppercase">{label}</label>
      {children}
    </div>
  )
}
