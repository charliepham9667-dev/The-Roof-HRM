import { ComingSoon } from "@/pages/common/ComingSoon"

export function KnowledgeBase() {
  return (
    <ComingSoon
      title="Knowledge Base"
      description="SOPs, training videos, manuals, and onboarding resources."
      next={[
        "Search + categories (SOP, training, safety, branding)",
        "Access control by role + acknowledgment tracking",
        "Google Drive integration for documents",
      ]}
    />
  )
}

