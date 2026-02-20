import { useState } from 'react'
import {
  FileText,
  Plus,
  ExternalLink,
  X,
  Loader2,
  AlertCircle,
  Search,
  FileSpreadsheet,
  Presentation,
  Link,
  Video,
  FolderOpen,
} from 'lucide-react'
import { useResources, useCreateResource, useDeleteResource } from '../../hooks/useResources'
import type { ResourceLink, ResourceCategory } from '../../types'
import { cn } from '@/lib/utils'

// ─── Category config ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ResourceCategory, {
  label: string
  icon: string
  colorClass: string
  badgeClass: string
}> = {
  sop:      { label: 'SOPs',      icon: '📋', colorClass: 'text-info',            badgeClass: 'border-info/20 bg-info/8 text-info' },
  training: { label: 'Training',  icon: '📚', colorClass: 'text-success',         badgeClass: 'border-success/20 bg-success/8 text-success' },
  safety:   { label: 'Safety',    icon: '🛡️',  colorClass: 'text-error',           badgeClass: 'border-error/20 bg-error/8 text-error' },
  branding: { label: 'Branding',  icon: '✦',  colorClass: 'text-purple-400',      badgeClass: 'border-purple-400/20 bg-purple-400/8 text-purple-400' },
  hr:       { label: 'HR',        icon: '👥', colorClass: 'text-warning',         badgeClass: 'border-warning/20 bg-warning/8 text-warning' },
  menu:     { label: 'Menu',      icon: '🍽️',  colorClass: 'text-primary',         badgeClass: 'border-primary/20 bg-primary/8 text-primary' },
  recipes:  { label: 'Recipes',   icon: '🧪', colorClass: 'text-teal-500',        badgeClass: 'border-teal-500/20 bg-teal-500/8 text-teal-500' },
  licenses: { label: 'Licenses',  icon: '📜', colorClass: 'text-cyan-400',        badgeClass: 'border-cyan-400/20 bg-cyan-400/8 text-cyan-400' },
  other:    { label: 'Other',     icon: '◎',  colorClass: 'text-muted-foreground', badgeClass: 'border-border bg-secondary text-muted-foreground' },
}

// ─── File type config ────────────────────────────────────────────────────────

type FileType = 'pdf' | 'doc' | 'sheet' | 'slide' | 'video' | 'link' | 'other'

const FILE_CONFIG: Record<FileType, {
  label: string
  icon: React.ReactNode
  bgClass: string
  badgeClass: string
}> = {
  pdf:   { label: 'PDF',    icon: <FileText className="h-4 w-4" />,        bgClass: 'bg-error/10 text-error',    badgeClass: 'border-error/20 bg-error/8 text-error' },
  doc:   { label: 'Doc',    icon: <FileText className="h-4 w-4" />,        bgClass: 'bg-info/10 text-info',      badgeClass: 'border-info/20 bg-info/8 text-info' },
  sheet: { label: 'Sheet',  icon: <FileSpreadsheet className="h-4 w-4" />, bgClass: 'bg-success/10 text-success', badgeClass: 'border-success/20 bg-success/8 text-success' },
  slide: { label: 'Slides', icon: <Presentation className="h-4 w-4" />,    bgClass: 'bg-warning/10 text-warning', badgeClass: 'border-warning/20 bg-warning/8 text-warning' },
  video: { label: 'Video',  icon: <Video className="h-4 w-4" />,           bgClass: 'bg-purple-400/10 text-purple-400', badgeClass: 'border-purple-400/20 bg-purple-400/8 text-purple-400' },
  link:  { label: 'Link',   icon: <Link className="h-4 w-4" />,            bgClass: 'bg-primary/10 text-primary', badgeClass: 'border-primary/20 bg-primary/8 text-primary' },
  other: { label: 'File',   icon: <FileText className="h-4 w-4" />,        bgClass: 'bg-secondary text-muted-foreground', badgeClass: 'border-border bg-secondary text-muted-foreground' },
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
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-[3px] text-foreground">Resource Library</h1>
          <p className="mt-1 text-xs text-muted-foreground tracking-wide">
            SOPs, training materials, and important documents — all linked to Google Drive
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-xs tracking-widest text-primary-foreground uppercase hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Resource
        </button>
      </div>

      {/* ── Category tabs — Row 1 ── */}
      <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-[repeat(5,1fr)] gap-2">
        {/* All */}
        <CategoryTab
          icon="◈"
          label="All"
          count={countFor('all')}
          active={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        />
        {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).slice(0, 4).map((cat) => (
          <CategoryTab
            key={cat}
            icon={CATEGORY_CONFIG[cat].icon}
            label={CATEGORY_CONFIG[cat].label}
            count={countFor(cat)}
            active={categoryFilter === cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
          />
        ))}
      </div>

      {/* ── Category tabs — Row 2 ── */}
      <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-[repeat(5,1fr)] gap-2 -mt-3">
        {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).slice(4).map((cat) => (
          <CategoryTab
            key={cat}
            icon={CATEGORY_CONFIG[cat].icon}
            label={CATEGORY_CONFIG[cat].label}
            count={countFor(cat)}
            active={categoryFilter === cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
          />
        ))}
      </div>

      {/* ── Filter row ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] tracking-[2px] text-muted-foreground uppercase">File Type</span>
          {(['all', 'pdf', 'doc', 'sheet', 'slide', 'video', 'link'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded-full border px-3 py-0.5 text-[10px] tracking-wide uppercase transition-colors',
                typeFilter === t
                  ? 'bg-foreground border-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-secondary-foreground',
              )}
            >
              {t === 'all' ? 'All' : t === 'pdf' ? '📄 PDF' : t === 'doc' ? '📝 Doc' : t === 'sheet' ? '📊 Sheet' : t === 'slide' ? '📑 Slides' : t === 'video' ? '🎬 Video' : '🔗 Link'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-sm border border-border bg-card pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border/80 w-52"
            />
          </div>
          <span className="text-[10px] tracking-wide text-muted-foreground whitespace-nowrap">
            {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Resource grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <div className="text-sm text-muted-foreground">No resources found</div>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Add a resource
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onOpen={() => setDetailResource(r)}
            />
          ))}
        </div>
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

// ─── Category tab ────────────────────────────────────────────────────────────

function CategoryTab({
  icon, label, count, active, onClick,
}: { icon: string; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-center transition-all shadow-card hover:shadow-md hover:-translate-y-px',
        active
          ? 'border-primary/40 bg-primary/[0.06]'
          : 'border-border bg-card hover:border-border/80',
      )}
    >
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
      )}
      <span className="text-xl leading-none">{icon}</span>
      <span className={cn(
        'text-[9px] tracking-wide uppercase leading-none',
        active ? 'text-primary' : 'text-secondary-foreground',
      )}>
        {label}
      </span>
      <span className={cn(
        'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
        active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
      )}>
        {count}
      </span>
    </button>
  )
}

// ─── Resource card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, onOpen }: { resource: ResourceLink; onOpen: () => void }) {
  const deleteResource = useDeleteResource()
  const cat = CATEGORY_CONFIG[resource.category]
  const ft = FILE_CONFIG[getFileType(resource)]

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col gap-2.5 rounded-card border border-border bg-card p-5 shadow-card cursor-pointer transition-all hover:shadow-md hover:-translate-y-px hover:border-border/80 overflow-hidden"
    >
      {/* Top accent line on hover */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
        resource.category === 'sop' ? 'bg-info' :
        resource.category === 'training' ? 'bg-success' :
        resource.category === 'safety' ? 'bg-error' :
        resource.category === 'branding' ? 'bg-purple-400' :
        resource.category === 'hr' ? 'bg-warning' :
        resource.category === 'menu' ? 'bg-primary' :
        resource.category === 'recipes' ? 'bg-teal-500' :
        resource.category === 'licenses' ? 'bg-cyan-400' : 'bg-border',
      )} />

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

      {/* Title */}
      <div className="text-sm font-medium text-foreground leading-snug">{resource.title}</div>

      {/* Description */}
      {resource.description && (
        <div className="text-xs text-secondary-foreground leading-relaxed line-clamp-2">{resource.description}</div>
      )}

      {/* Open details hint */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[10px] tracking-wide text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase">
          Open details ↗
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
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-card border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-border">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl', ft.bgClass)}>
            {ft.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase', cat.badgeClass)}>{cat.label}</span>
              <span className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase', ft.badgeClass)}>{ft.label}</span>
            </div>
            <div className="font-display text-xl tracking-[1px] text-foreground leading-snug">{resource.title}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {resource.description && (
            <div>
              <div className="text-[9px] tracking-[3px] text-muted-foreground uppercase mb-1.5">Description</div>
              <div className="text-sm text-secondary-foreground leading-relaxed">{resource.description}</div>
            </div>
          )}

          <div>
            <div className="text-[9px] tracking-[3px] text-muted-foreground uppercase mb-2">Open in Google Drive</div>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-card border border-border bg-secondary/50 px-4 py-3 transition-all hover:border-border/80 hover:shadow-card"
            >
              <span className="text-2xl">🗂️</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{resource.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Google Drive — click to open in new tab</div>
              </div>
              <ExternalLink className="h-4 w-4 text-primary shrink-0" />
            </a>
          </div>

          {resource.subcategory && (
            <div>
              <div className="text-[9px] tracking-[3px] text-muted-foreground uppercase mb-1.5">Tags</div>
              <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {resource.subcategory}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/30">
          <button
            onClick={onClose}
            className="rounded-sm border border-border px-4 py-1.5 text-xs tracking-wide text-muted-foreground uppercase hover:text-secondary-foreground transition-colors"
          >
            Close
          </button>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-1.5 text-xs tracking-wide text-primary-foreground uppercase hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Drive
          </a>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-card border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-border">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl text-primary">
            <Plus className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[9px] tracking-[2px] text-muted-foreground uppercase mb-0.5">New Resource</div>
            <div className="font-display text-xl tracking-[1px] text-foreground">Add to Library</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <Field label="Resource Title">
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
              <Field label="Subcategory / Tag">
                <input
                  className="form-input-base"
                  placeholder="e.g. Bar SOPs"
                  value={formData.subcategory}
                  onChange={(e) => setFormData(f => ({ ...f, subcategory: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className="form-input-base resize-none"
                rows={3}
                placeholder="Brief description of what this document covers…"
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

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-border px-4 py-1.5 text-xs tracking-wide text-muted-foreground uppercase hover:text-secondary-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createResource.isPending}
              className="flex items-center gap-2 rounded-sm bg-primary px-4 py-1.5 text-xs tracking-wide text-primary-foreground uppercase hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createResource.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Resource
            </button>
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
