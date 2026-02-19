import { useMemo, useState } from "react"
import { Maximize2, Plus, Users, ZoomIn, ZoomOut } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage, Button, Input, PageHeader, ScrollArea } from "@/components/ui"
import { OrgChartNode, ProfileDetailPanel } from "@/components/org-chart"
import { type OrgMember, useOrgChart, useUpdateReportsTo } from "@/hooks/useOrgChart"
import { cn } from "@/lib/utils"

function OrgChartPage() {
  const { members, orgTree, isLoading, error } = useOrgChart()
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null)
  const [zoom, setZoom] = useState(100)
  const [editMode, setEditMode] = useState(false)
  const [unassignedQuery, setUnassignedQuery] = useState("")
  const [moveMessage, setMoveMessage] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const updateReportsTo = useUpdateReportsTo()

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 150))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50))
  const handleResetZoom = () => setZoom(100)

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of members) {
      if (!m.reports_to) continue
      const arr = map.get(m.reports_to) || []
      arr.push(m.id)
      map.set(m.reports_to, arr)
    }
    return map
  }, [members])

  function isDescendant(ancestorId: string, maybeDescendantId: string): boolean {
    const stack = [...(childrenMap.get(ancestorId) || [])]
    const seen = new Set<string>()
    while (stack.length) {
      const cur = stack.pop()!
      if (cur === maybeDescendantId) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      const kids = childrenMap.get(cur) || []
      for (const k of kids) stack.push(k)
    }
    return false
  }

  function handleMove(draggedId: string, newReportsTo: string | null) {
    setMoveMessage(null)
    setMoveError(null)

    if (newReportsTo === draggedId) {
      setMoveError("You can’t report to yourself.")
      return
    }
    if (newReportsTo && isDescendant(draggedId, newReportsTo)) {
      setMoveError("Invalid move: that would create a reporting cycle.")
      return
    }

    updateReportsTo.mutate(
      { memberId: draggedId, reportsTo: newReportsTo },
      {
        onSuccess: () => setMoveMessage("Org chart updated."),
        onError: (err) =>
          setMoveError((err as Error)?.message || "Failed to update org chart."),
      },
    )
  }

  function handleDropTopLevel(e: React.DragEvent) {
    if (!editMode) return
    e.preventDefault()
    const draggedId = e.dataTransfer.getData("text/plain")
    if (!draggedId) return
    handleMove(draggedId, null)
  }

  const inTreeIds = useMemo(() => {
    return collectTreeIds(orgTree)
  }, [orgTree])

  const unassignedMembers = useMemo(() => {
    const q = unassignedQuery.trim().toLowerCase()
    const list = members.filter((m) => !inTreeIds.has(m.id))
    if (!q) return list
    return list.filter((m) => (m.full_name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q))
  }, [members, inTreeIds, unassignedQuery])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Org Chart"
        description="View your organization structure and team hierarchy"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-sm text-muted-foreground">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant={editMode ? "default" : "outline"}
              className={
                editMode
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "border-purple-600/30 text-purple-700 hover:bg-purple-600/10"
              }
              onClick={() => {
                setEditMode((v) => !v)
                setMoveMessage(null)
                setMoveError(null)
              }}
            >
              {editMode ? "Editing" : "Edit chart"}
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {members.filter((m) => m.role === "owner").length} Owners
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-info/10 px-4 py-2">
          <Users className="h-4 w-4 text-info" />
          <span className="text-sm font-medium">
            {members.filter((m) => m.role === "manager").length} Managers
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {members.filter((m) => m.role === "staff").length} Staff
          </span>
        </div>
      </div>

      {(moveMessage || moveError || editMode) && (
        <div className="mb-4 space-y-2">
          {editMode && (
            <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 px-3 py-2 text-sm text-purple-800">
              Drag an employee onto another employee to change who they report to. Drop onto “Top level” to remove a manager.
            </div>
          )}
          {moveMessage && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {moveMessage}
            </div>
          )}
          {moveError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {moveError}
            </div>
          )}
        </div>
      )}

      {editMode && unassignedMembers.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Unassigned team members</div>
              <div className="text-xs text-muted-foreground">
                Drag these people onto the chart to assign who they report to.
              </div>
            </div>
            <div className="w-full sm:w-[280px]">
              <Input
                value={unassignedQuery}
                onChange={(e) => setUnassignedQuery(e.target.value)}
                placeholder="Search unassigned…"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedMembers.slice(0, 18).map((m) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", m.id)
                  e.dataTransfer.effectAllowed = "move"
                }}
                className={cn(
                  "flex cursor-grab items-center gap-3 rounded-lg border border-border bg-background px-3 py-2",
                  "hover:border-purple-600/30 hover:bg-purple-600/5 active:cursor-grabbing",
                )}
                title="Drag onto a manager to assign"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url || undefined} alt={m.full_name} />
                  <AvatarFallback className="text-xs font-semibold">
                    {(m.full_name || m.email || "?")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.full_name || m.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.job_role || m.department || "Employee"}</div>
                </div>
              </div>
            ))}
          </div>

          {unassignedMembers.length > 18 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Showing 18 of {unassignedMembers.length}. Use search to find others.
            </div>
          )}
        </div>
      )}

      {editMode && (
        <div
          className="mb-6 rounded-xl border border-dashed border-purple-600/30 bg-card px-4 py-3 text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropTopLevel}
        >
          Top level (drop here to remove manager)
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-muted/30">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Loading organization chart...</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-error">Failed to load organization chart</p>
          </div>
        ) : !orgTree ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Users className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">No team members found</p>
            <Button onClick={() => (window.location.href = "/owner/team-directory")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team Members
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div
              className="flex min-h-full justify-center p-8"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <OrgChartNode
                member={orgTree}
                onSelect={setSelectedMember}
                isRoot
                editable={editMode}
                onMove={handleMove}
              />
            </div>
          </ScrollArea>
        )}
      </div>

      {selectedMember && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedMember(null)} />
          <ProfileDetailPanel member={selectedMember} onClose={() => setSelectedMember(null)} />
        </>
      )}
    </div>
  )
}

// Keep named export for existing imports/routes
export function OrgChart() {
  return <OrgChartPage />
}

export default OrgChartPage

function collectTreeIds(root: OrgMember | null): Set<string> {
  const set = new Set<string>()
  if (!root) return set
  const stack: OrgMember[] = [root]
  while (stack.length) {
    const cur = stack.pop()!
    set.add(cur.id)
    const kids = cur.direct_reports || []
    for (const k of kids) stack.push(k)
  }
  return set
}

