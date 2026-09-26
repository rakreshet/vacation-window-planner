export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  return (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1
}
