export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  return (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1
}

export function localCalendarDate(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date())
}

export function annualDateBounds(year: string, timeZone?: string) {
  const today = localCalendarDate(timeZone)
  return { minimum: today > `${year}-01-01` ? today : `${year}-01-01`, maximum: `${year}-12-31` }
}
