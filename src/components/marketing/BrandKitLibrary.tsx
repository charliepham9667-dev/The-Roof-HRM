import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import {
  FileText,
  FileImage,
  FileVideo,
  File as FileIcon,
  ExternalLink,
  UploadCloud,
  FolderOpen,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionTitle } from "@/components/ui/section-title"
import {
  getMarketingAssetSignedUrl,
  useAllMarketingPlanAssets,
  useQuickUploadBrandKitAsset,
  type MarketingPlanAssetWithPlan,
} from "@/hooks/useMarketingPlans"

function kindFromMime(mime: string | null | undefined, name: string): "pdf" | "image" | "video" | "deck" | "other" {
  const lower = (mime || "").toLowerCase()
  const n = name.toLowerCase()
  if (lower.includes("pdf") || n.endsWith(".pdf")) return "pdf"
  if (lower.startsWith("image") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(n)) return "image"
  if (lower.startsWith("video") || /\.(mp4|mov|webm|m4v)$/i.test(n)) return "video"
  if (/\.(key|pptx?|odp|pages|numbers|xlsx?)$/i.test(n)) return "deck"
  return "other"
}

function bytesLabel(b: number | null | undefined) {
  if (!b || !Number.isFinite(b)) return ""
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function kindMeta(kind: ReturnType<typeof kindFromMime>) {
  switch (kind) {
    case "pdf":
      return { Icon: FileText, tone: "text-[#b5620a]", bg: "bg-[#fdf3e7]", border: "border-[#f5d4ba]", label: "PDF" }
    case "image":
      return { Icon: FileImage, tone: "text-[#5a3a8a]", bg: "bg-[#ede8f5]", border: "border-[#d4c9e8]", label: "IMAGE" }
    case "video":
      return { Icon: FileVideo, tone: "text-error", bg: "bg-error/10", border: "border-error/25", label: "VIDEO" }
    case "deck":
      return { Icon: Layers, tone: "text-[#7a5a10]", bg: "bg-[#f5edd8]", border: "border-[#e8d9b0]", label: "DECK" }
    default:
      return { Icon: FileIcon, tone: "text-muted-foreground", bg: "bg-secondary/60", border: "border-border", label: "FILE" }
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "active": return "border-success/25 bg-success/8 text-success"
    case "completed": return "border-border bg-secondary text-muted-foreground"
    case "archived": return "border-border bg-secondary text-muted-foreground/70"
    default: return "border-warning/25 bg-warning/8 text-warning"
  }
}

async function openAsset(filePath: string) {
  const { data, error } = await getMarketingAssetSignedUrl(filePath)
  if (error || !data?.signedUrl) {
    alert("Couldn't generate a preview link. Try again or refresh.")
    return
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer")
}

interface BrandKitLibraryProps {
  onOpenPlans?: () => void
}

export function BrandKitLibrary({ onOpenPlans }: BrandKitLibraryProps) {
  const { data: assets = [], isLoading } = useAllMarketingPlanAssets(24)
  const quickUpload = useQuickUploadBrandKitAsset()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const byPlan = useMemo(() => {
    const map = new Map<string, { planId: string; planTitle: string; planStatus: string; assets: MarketingPlanAssetWithPlan[] }>()
    for (const a of assets) {
      const existing = map.get(a.plan_id)
      if (existing) {
        existing.assets.push(a)
      } else {
        map.set(a.plan_id, {
          planId: a.plan_id,
          planTitle: a.plan_title,
          planStatus: a.plan_status,
          assets: [a],
        })
      }
    }
    return Array.from(map.values())
  }, [assets])

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return
    setErrorMsg(null)
    for (const file of Array.from(files)) {
      try {
        await quickUpload.mutateAsync(file)
      } catch (e: any) {
        const msg = e?.message || "Upload failed"
        const friendly = /maximum allowed size/i.test(msg)
          ? `${file.name} is too large. Files up to 100 MB are supported; split or compress bigger decks first (run \`node scripts/upload-marketing-kit-split.mjs <file>\` to auto-chunk PDFs).`
          : msg
        setErrorMsg(friendly)
        return
      }
    }
  }

  return (
    <div className="space-y-3">
      <SectionTitle label="Brand Kit & Reference Library" />

      {/* Quick upload dropzone */}
      <div
        className={cn(
          "rounded-card border-2 border-dashed bg-card shadow-card p-5 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                Drop marketing, event &amp; branding references here
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                PDFs, decks, brand guidelines, campaign briefs, event lookbooks — everyone on the marketing team can
                open them from here. Files are stored privately in Supabase. Up to 100&nbsp;MB per file.
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={quickUpload.isPending}
              className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
            >
              {quickUpload.isPending ? "Uploading…" : "Choose file(s)"}
            </button>
            {onOpenPlans && (
              <button
                type="button"
                onClick={onOpenPlans}
                className="rounded-sm border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/70 flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Manage plans
              </button>
            )}
          </div>
        </div>
        {errorMsg && (
          <div className="mt-3 rounded-sm border border-error/25 bg-error/8 px-3 py-2 text-xs text-error">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Library */}
      {isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
          Loading library…
        </div>
      ) : byPlan.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm shadow-card">
          <div className="text-foreground font-semibold">No references uploaded yet.</div>
          <p className="text-muted-foreground mt-1">
            Drop your marketing / event / branding kit above. Every file becomes instantly available to the marketing
            team from this dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {byPlan.map((group) => (
            <div key={group.planId} className="rounded-card border border-border bg-card shadow-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-[18px] py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-primary">◈</span>
                  <div className="text-sm font-semibold text-foreground truncate">{group.planTitle}</div>
                </div>
                <span className={cn("rounded-sm border px-[6px] py-[2px] text-[10px] tracking-wide uppercase", statusBadge(group.planStatus))}>
                  {group.planStatus}
                </span>
                <div className="ml-auto text-[11px] text-muted-foreground">
                  {group.assets.length} file{group.assets.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {group.assets.slice(0, 6).map((asset) => {
                  const kind = kindFromMime(asset.mime_type, asset.file_name)
                  const meta = kindMeta(kind)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => openAsset(asset.file_path)}
                      className="group flex items-start gap-3 text-left px-4 py-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className={cn("shrink-0 w-10 h-10 rounded-md border flex items-center justify-center", meta.bg, meta.border, meta.tone)}>
                        <meta.Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {asset.file_name}
                        </div>
                        <div className="text-[10px] tracking-wider text-muted-foreground uppercase mt-0.5">
                          {meta.label}
                          {asset.size_bytes ? ` · ${bytesLabel(asset.size_bytes)}` : ""}
                          {" · "}
                          {format(new Date(asset.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <ExternalLink className="shrink-0 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </button>
                  )
                })}
              </div>
              {group.assets.length > 6 && onOpenPlans && (
                <button
                  type="button"
                  onClick={onOpenPlans}
                  className="w-full text-center py-2 text-xs text-muted-foreground hover:text-primary border-t border-border"
                >
                  + {group.assets.length - 6} more · open plan to view all
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
