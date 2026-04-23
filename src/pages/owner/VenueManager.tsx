import { useAuthStore } from "@/stores/authStore"
import { ReservationsListView } from "@/components/venue/ReservationsListView"

function canEditReservations(profile: any): boolean {
  if (!profile) return false
  if (profile.role === "owner") return true
  if (profile.managerType === "floor") return true
  const job = (profile.jobRole || "").toLowerCase()
  return job === "cashier" || job === "receptionist"
}

export function VenueManager() {
  const profile = useAuthStore((s) => s.profile)
  const canEdit = canEditReservations(profile)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-[28px] font-bold leading-tight text-foreground">Venue Manager</h1>
            <p className="text-xs md:text-sm text-muted-foreground">The Roof · 3F</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ReservationsListView canEdit={canEdit} />
      </div>
    </div>
  )
}

export default VenueManager
