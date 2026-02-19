import { cn } from "@/lib/utils"

export interface OwnerGreetingHeaderProps {
  userName: string
  date?: Date
  className?: string
}

function getGreeting(now: Date) {
  const h = now.getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function OwnerGreetingHeader({
  userName,
  date = new Date(),
  className,
}: OwnerGreetingHeaderProps) {
  const greeting = getGreeting(date)
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date)

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {greeting}, {userName}
      </div>
      <div className="text-sm text-muted-foreground">{formattedDate}</div>
    </div>
  )
}

