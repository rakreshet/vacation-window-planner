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
