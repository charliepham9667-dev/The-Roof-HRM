const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"

export function toIsoDateInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone }).formatToParts(date)
  const values = new Map(parts.map((p) => [p.type, p.value]))
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

export function getTodayIsoInTimezone(timeZone?: string): string {
  return toIsoDateInTimezone(new Date(), timeZone)
}
