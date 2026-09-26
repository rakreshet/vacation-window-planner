import type { ActionSnapshot } from './actionSnapshots'

export function leaveRequestText(snapshot: ActionSnapshot): string {
  const { window, assessment, context } = snapshot
  const dates = assessment.charged_dates.length
    ? `Working dates to request: ${assessment.charged_dates.join(', ')}`
    : 'No vacation days are required under the recorded calendar.'
  return [
    `Proposed break: ${window.start_date} through ${window.end_date} (inclusive)`,
    `Vacation days required: ${window.vacation_days_used}`,
    dates,
    `Calculated: ${context.calculated_at}`,
    ...planningWarnings(snapshot),
    'Planning option; not an approval. Please confirm with your employer.',
  ].join('\n')
}

export function calendarFile(
  snapshot: ActionSnapshot,
  title = 'Proposed vacation',
  timestamp = new Date(),
): string {
  const end = new Date(`${snapshot.window.end_date}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  if (Number.isNaN(end.getTime()) || end.getUTCFullYear() > 9999)
    throw new Error(
      'The end date cannot be represented in a calendar file. Copy the request instead.',
    )
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vacation Window Planner//EN',
    'BEGIN:VEVENT',
    `UID:${snapshot.export_uid}`,
    `DTSTAMP:${timestamp
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${snapshot.window.start_date.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(leaveRequestText(snapshot))}`,
    'STATUS:TENTATIVE',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n')
}

function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

function foldLine(value: string): string {
  const lines: string[] = []
  let current = ''
  let bytes = 0
  for (const character of value) {
    const length = new TextEncoder().encode(character).length
    if (bytes + length > 75) {
      lines.push(current)
      current = ' '
      bytes = 1
    }
    current += character
    bytes += length
  }
  lines.push(current)
  return lines.join('\r\n')
}

function planningWarnings(snapshot: ActionSnapshot): string[] {
  return [
    ...snapshot.assessment.warnings.map((warning) =>
      warning === 'full_balance'
        ? 'Uses the full recorded leave balance.'
        : 'Uses a negative leave balance.',
    ),
    ...snapshot.assessment.eligibility_reasons.map((reason) => {
      if (reason.code === 'unavailable_dates')
        return `Unavailable dates: ${reason.dates.join(', ')}`
      if (reason.code === 'insufficient_notice')
        return `Minimum notice requires a start on or after ${reason.earliest_start_date}`
      return 'Exceeds the recorded leave allowance.'
    }),
  ]
}
