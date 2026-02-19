import { ComingSoon } from "@/pages/common/ComingSoon"

export function Incidents() {
  return (
    <ComingSoon
      title="Incident Reporting"
      description="Disciplinary notes, incidents, and compliance-related reporting."
      next={[
        "Incident log + attachments",
        "Link incidents to staff profiles",
        "Approval + audit history",
      ]}
    />
  )
}

