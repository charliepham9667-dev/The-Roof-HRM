import { OwnerOverview } from "@/components/dashboard/OwnerOverview"

export function FinancialSummary() {
  // "Live Snapshot" is the OwnerOverview dashboard.
  // We render it here so the Financial Suite entry becomes the home for the snapshot.
  return <OwnerOverview />
}

