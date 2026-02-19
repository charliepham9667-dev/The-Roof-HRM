import { ComingSoon } from "@/pages/common/ComingSoon"

export function Promotions() {
  return (
    <ComingSoon
      title="Promotions"
      description="Plan and coordinate promotions that affect today’s operations."
      next={[
        "List + status (draft/scheduled/active)",
        "Promotion calendar view",
        "Tie promotions to events and reservations",
      ]}
    />
  )
}

