/** Dates in saved snapshots stay unchanged; these helpers only format their presentation. */
export function formatSavedDate(value: string, timeZone?: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date)
}

export function formatSavedWindow(window: { start_date: string; end_date: string }): string {
  const start = new Date(`${window.start_date}T00:00:00Z`)
  const end = new Date(`${window.end_date}T00:00:00Z`)
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(start, end)
}
