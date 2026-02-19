import { ComingSoon } from "@/pages/common/ComingSoon"

export function Payslips() {
  return (
    <ComingSoon
      title="Payslips"
      description="Self-service: view payslips and payment history."
      next={[
        "Payslip list with date ranges",
        "Download/print payslip PDFs",
        "Tax and payment summary",
      ]}
    />
  )
}

