import { useMemo, useState } from "react"
import {
  getMarketingAssetSignedUrl,
  useCreateMarketingPlan,
  useDeleteMarketingPlan,
  useDeleteMarketingPlanAsset,
  useMarketingPlanAssets,
  useMarketingPlans,
  useUpdateMarketingPlan,
  useUploadMarketingPlanAsset,
  type MarketingPlanStatus,
} from "@/hooks/useMarketingPlans"

export default function MarketingPlans() {
  const { data: plans = [] } = useMarketingPlans()
  const createPlan = useCreateMarketingPlan()
  const updatePlan = useUpdateMarketingPlan()
  const deletePlan = useDeleteMarketingPlan()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) || null, [plans, selectedPlanId])
  const { data: assets = [] } = useMarketingPlanAssets(selectedPlanId)
  const uploadAsset = useUploadMarketingPlanAsset(selectedPlanId || "")
  const deleteAsset = useDeleteMarketingPlanAsset(selectedPlanId || "")

  const [title, setTitle] = useState("")
  const [objective, setObjective] = useState("")
  const [status, setStatus] = useState<MarketingPlanStatus>("draft")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [notes, setNotes] = useState("")

  async function onCreate() {
    if (!title.trim()) return
    const created = await createPlan.mutateAsync({
      title: title.trim(),
      objective: objective.trim(),
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes.trim(),
    })
    setSelectedPlanId(created.id)
    setTitle("")
    setObjective("")
    setStatus("draft")
    setStartDate("")
    setEndDate("")
    setNotes("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-foreground">Marketing Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">Create, track, and store campaign plans and assets.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">New Plan</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan title" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
          <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objective" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as MarketingPlanStatus)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes" className="w-full rounded border border-border bg-background px-3 py-2 text-sm resize-none" />
          <button onClick={onCreate} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={createPlan.isPending}>
            {createPlan.isPending ? "Creating..." : "Create Plan"}
          </button>
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-card space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Plans</div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full rounded border px-3 py-2 text-left ${selectedPlanId === plan.id ? "border-primary bg-primary/5" : "border-border bg-background"}`}
              >
                <div className="text-sm font-medium text-foreground">{plan.title}</div>
                <div className="text-xs text-muted-foreground">{plan.objective || "No objective"} · {plan.status}</div>
              </button>
            ))}
            {plans.length === 0 && <div className="text-sm text-muted-foreground">No plans yet.</div>}
          </div>

          {selectedPlan && (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{selectedPlan.title}</div>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this plan?")) return
                    await deletePlan.mutateAsync(selectedPlan.id)
                    setSelectedPlanId(null)
                  }}
                  className="text-xs text-error"
                >
                  Delete
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updatePlan.mutate({ id: selectedPlan.id, status: "active" })}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  Mark Active
                </button>
                <button
                  onClick={() => updatePlan.mutate({ id: selectedPlan.id, status: "completed" })}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  Mark Completed
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Assets</div>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && selectedPlanId) uploadAsset.mutate(file)
                  }}
                  className="text-xs"
                />
                <div className="space-y-1">
                  {assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5">
                      <button
                        className="text-xs text-foreground underline-offset-2 hover:underline"
                        onClick={async () => {
                          const { data } = await getMarketingAssetSignedUrl(asset.file_path)
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer")
                        }}
                      >
                        {asset.file_name}
                      </button>
                      <button onClick={() => deleteAsset.mutate({ id: asset.id, file_path: asset.file_path })} className="text-xs text-error">
                        Remove
                      </button>
                    </div>
                  ))}
                  {assets.length === 0 && <div className="text-xs text-muted-foreground">No assets uploaded.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
