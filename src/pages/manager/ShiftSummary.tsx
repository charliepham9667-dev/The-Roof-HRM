import { ComingSoon } from "@/pages/common/ComingSoon"

export function ShiftSummary() {
  return (
    <ComingSoon
      title="Shift Summary"
      description="Manager tool: shift notes, coverage, incidents, and end-of-shift recap that can feed the Owner dashboard."
      next={[
        "Coverage + late arrivals snapshot",
        "Checklist completion rollup",
        "Notes + incidents + handover summary",
      ]}
    />
  )
}

