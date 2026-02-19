import { ComingSoon } from "@/pages/common/ComingSoon"

export function PermissionsSettings() {
  return (
    <ComingSoon
      title="Permissions"
      description="System Settings: granular access control for modules and actions."
      next={[
        "Define permission model (modules + actions)",
        "Assign permissions to roles",
        "Audit log for changes",
      ]}
    />
  )
}

