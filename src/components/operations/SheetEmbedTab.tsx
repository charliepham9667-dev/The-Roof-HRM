import { useEffect, useState } from "react"
import { ExternalLink, Link2, Loader2, RefreshCw, Settings2, Sheet as SheetIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deriveEmbedUrl,
  useDeleteOperationsSheetLink,
  useOperationsSheetLink,
  useUpsertOperationsSheetLink,
  type OperationsSheetKind,
} from "@/hooks/useOperationsSheetLinks"

type Props = {
  kind: OperationsSheetKind
  title: string
  description: string
  canManage: boolean
  fullView?: boolean
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function SheetEmbedTab({ kind, title, description, canManage, fullView = false }: Props) {
  const { data: link, isLoading } = useOperationsSheetLink(kind)
  const upsert = useUpsertOperationsSheetLink()
  const remove = useDeleteOperationsSheetLink()

  const [configOpen, setConfigOpen] = useState(false)
  const [draftUrl, setDraftUrl] = useState("")
  const [draftTitle, setDraftTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    if (configOpen) {
      setDraftUrl(link?.sheet_url ?? "")
      setDraftTitle(link?.sheet_title ?? "")
      setError(null)
    }
  }, [configOpen, link])

  const derivedPreview = draftUrl ? deriveEmbedUrl(draftUrl) : null

  const handleSave = async () => {
    setError(null)
    try {
      await upsert.mutateAsync({
        kind,
        sheetUrl: draftUrl,
        sheetTitle: draftTitle || null,
      })
      setConfigOpen(false)
      setIframeKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sheet link")
    }
  }

  const handleRemove = async () => {
    if (!link) return
    if (!window.confirm(`Remove the ${title.toLowerCase()} sheet link?`)) return
    try {
      await remove.mutateAsync(kind)
      setConfigOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove sheet link")
    }
  }

  return (
    <div className={fullView ? "flex flex-col gap-3" : "flex flex-col gap-3 flex-1 min-h-0"}>
      <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <SheetIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            {link?.sheet_title || title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {link?.updated_at && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Last saved {formatRelativeTime(link.updated_at)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {link?.embed_url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reload the embedded sheet"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
          {link?.sheet_url && (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={link.sheet_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open in Sheets
              </a>
            </Button>
          )}
          {canManage && (
            <Button type="button" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {link ? "Edit link" : "Connect sheet"}
            </Button>
          )}
        </div>
      </div>

      <div
        className={
          fullView
            ? "min-h-[520px] rounded-card border border-border bg-card shadow-card overflow-visible"
            : "flex-1 min-h-[520px] rounded-card border border-border bg-card shadow-card overflow-hidden"
        }
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
          </div>
        ) : link?.embed_url ? (
          <iframe
            key={iframeKey}
            title={link.sheet_title || title}
            src={link.embed_url}
            className={
              fullView
                ? "w-full h-[1100px] border-0"
                : "w-full h-full min-h-[520px] border-0"
            }
            loading="lazy"
          />
        ) : (
          <EmptyState
            title={title}
            canManage={canManage}
            onConnect={() => setConfigOpen(true)}
          />
        )}
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{link ? "Edit" : "Connect"} Google Sheet · {title}</DialogTitle>
            <DialogDescription>
              In Google Sheets, open <strong>File &gt; Share &gt; Publish to web</strong>, choose the
              tab you want to display, and copy the published link. You can also paste a
              regular <code>/edit</code> URL if the sheet is already shared with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`sheet-url-${kind}`}>Google Sheets URL</Label>
              <Input
                id={`sheet-url-${kind}`}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`sheet-title-${kind}`}>Display title (optional)</Label>
              <Input
                id={`sheet-title-${kind}`}
                placeholder={title}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </div>
            {draftUrl && !derivedPreview && (
              <p className="text-xs text-warning">
                Couldn&apos;t parse that URL. Make sure it&apos;s a Google Sheets link.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            {link && canManage && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={remove.isPending}
                className="sm:mr-auto text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remove link
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending || !draftUrl.trim()}
            >
              {upsert.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" /> Save link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({
  title,
  canManage,
  onConnect,
}: {
  title: string
  canManage: boolean
  onConnect: () => void
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-8">
      <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
        <SheetIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h3 className="font-semibold text-foreground">Connect a Google Sheet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the link to the Google Sheet you use for {title.toLowerCase()}. It will render
          live inside this tab so updates show automatically. Best results come from
          <em> File &gt; Share &gt; Publish to web</em>.
        </p>
      </div>
      {canManage ? (
        <Button type="button" onClick={onConnect} size="sm">
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          Connect sheet
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ask a manager or the owner to connect a sheet.
        </p>
      )}
    </div>
  )
}

export default SheetEmbedTab
