import { ReservationOverview } from "@/components/venue/ReservationOverview"

export function VenueManager() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      {/* Page header */}
      <div className="shrink-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground md:text-[38px]">
          Reservation Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">The Roof · 3F</p>
      </div>

      {/* Overview content */}
      <div className="flex-1 min-h-0 min-w-0">
        <ReservationOverview />
      </div>
    </div>
  )
}

export default VenueManager
