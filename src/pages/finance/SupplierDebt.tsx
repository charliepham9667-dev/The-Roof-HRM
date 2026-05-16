import { FinancialHeadroomView } from "@/components/finance/FinancialHeadroomView"

export function SupplierDebt() {
  return (
    <div className="space-y-6">
      <FinancialHeadroomView defaultTab="debt" />
    </div>
  )
}

export default SupplierDebt
