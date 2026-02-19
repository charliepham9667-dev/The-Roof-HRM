import { ComingSoon } from "@/pages/common/ComingSoon"

export function RolesSettings() {
  return (
    <ComingSoon
      title="Roles"
      description="System Settings: roles and assignment policies."
      next={[
        "Role list + member assignment",
        "Default permissions per role",
        "Role templates per venue",
      ]}
    />
  )
}

