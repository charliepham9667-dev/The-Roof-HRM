import { ComingSoon } from "@/pages/common/ComingSoon"

export function Onboarding() {
  return (
    <ComingSoon
      title="Onboarding / Offboarding"
      description="Automated workflows for hiring and departing staff."
      next={[
        "Document signing + checklists",
        "Gear assignment + access provisioning",
        "Exit workflow + access revocation",
      ]}
    />
  )
}

