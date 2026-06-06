import { useSearchParams } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FinancialHealthHeader } from "@/components/finance/FinancialHealthHeader"
import { FinancePill } from "@/components/finance/finance-ui"
import { CashPositionPanel } from "@/components/finance/CashPositionPanel"
import { SupplierDebtPanel } from "@/components/finance/SupplierDebtPanel"
import { UnifiedHeadroomPanel } from "@/components/finance/UnifiedHeadroomPanel"
import { useFinancialHeadroom } from "@/hooks/useFinancialHeadroom"

type HeadroomTab = "cash" | "debt" | "unified"

function parseTab(raw: string | null): HeadroomTab {
  if (raw === "debt" || raw === "unified") return raw
  return "cash"
}

type Props = {
  defaultTab?: HeadroomTab
}

export function FinancialHeadroomView({ defaultTab }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const activeTab = defaultTab ?? parseTab(requestedTab)
  const { latestCash, fridayIso } = useFinancialHeadroom()

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === "cash") params.delete("tab")
    else params.set("tab", next)
    setSearchParams(params, { replace: true })
  }

  const fridayLabel = format(parseISO(fridayIso), "EEEE MMM d")
  const snapshotDate = latestCash?.report_date
    ? format(parseISO(latestCash.report_date), "MMM d")
    : null

  return (
    <section className="space-y-0">
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-widest text-[#C74C3C] mb-0.5">
            Money · {fridayLabel}
          </p>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Cash position & supplier debt
            </h2>
            <p className="text-sm text-muted-foreground">
              Weekly Friday snapshot — track headroom, surface what&apos;s due, decide what to pay.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {snapshotDate && <FinancePill tone="info">Snapshot {snapshotDate}</FinancePill>}
          <FinancePill tone="success">Friday workflow</FinancePill>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-[#FAF4EF] border border-[#6C2B29]/10 p-1">
          <TabsTrigger value="cash">Cash Position</TabsTrigger>
          <TabsTrigger value="debt">Debt Tracker</TabsTrigger>
          <TabsTrigger value="unified">Unified view</TabsTrigger>
        </TabsList>

        <FinancialHealthHeader />

        <TabsContent value="cash" className="mt-0">
          <CashPositionPanel />
        </TabsContent>
        <TabsContent value="debt" className="mt-0">
          <SupplierDebtPanel />
        </TabsContent>
        <TabsContent value="unified" className="mt-0">
          <UnifiedHeadroomPanel />
        </TabsContent>
      </Tabs>
    </section>
  )
}

export default FinancialHeadroomView
