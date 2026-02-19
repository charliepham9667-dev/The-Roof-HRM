import { ComingSoon } from "@/pages/common/ComingSoon"

export function SOPSettings() {
  return (
    <ComingSoon
      title="SOP Management"
      description="System Settings: manage SOPs, versions, and acknowledgments."
      next={[
        "SOP list + versions",
        "Approval + publishing workflow",
        "Acknowledgment tracking per staff member",
      ]}
    />
  )
}

