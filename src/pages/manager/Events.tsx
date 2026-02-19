import { ComingSoon } from "@/pages/common/ComingSoon"

export function Events() {
  return (
    <ComingSoon
      title="Events"
      description="Coordinate events, meetings, and promos impacting staffing and reservations."
      next={[
        "Event list + calendar sync",
        "Event staffing requirements",
        "Link events to tasks and promotions",
      ]}
    />
  )
}

