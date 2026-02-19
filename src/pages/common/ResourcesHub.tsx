import { useAuthStore } from "@/stores/authStore"
import { ComingSoon } from "@/pages/common/ComingSoon"
import { Resources as OwnerResources } from "@/pages/owner/Resources"

export function ResourcesHub() {
  const profile = useAuthStore((s) => s.profile)

  if (profile?.role === "owner") {
    return <OwnerResources />
  }

  return (
    <ComingSoon
      title="Resource Library"
      description="Company Hub: documents, SOPs, templates, and links (role-based access)."
      next={[
        "Integrate with Google Drive (auth + folder mapping)",
        "Role-based access rules + approvals",
        "Pinning and versioning for SOPs",
      ]}
    />
  )
}

