import { useAuthStore } from "@/stores/authStore"
import { ComingSoon } from "@/pages/common/ComingSoon"
import { Calendar as OwnerCalendar } from "@/pages/owner/Calendar"

export function CalendarHub() {
  const profile = useAuthStore((s) => s.profile)

  if (profile?.role === "owner") {
    return <OwnerCalendar />
  }

  return (
    <ComingSoon
      title="Event Calendar"
      description="Company Hub: holidays, birthdays, meetings, and team events."
      next={[
        "Role-aware event visibility (all vs managers vs staff)",
        "Read receipts + acknowledgment for critical events",
        "Link events to promos, tasks, and staffing requirements",
      ]}
    />
  )
}

