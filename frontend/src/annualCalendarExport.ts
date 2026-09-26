import { annualSnapshotSchema, type AnnualSnapshot } from './savedAnnualPlans'
import { escapeText, foldLine } from './calendarExport'

export function annualLeaveRequestText(snapshot: AnnualSnapshot, includeBudget = false): string {
  const { result } = annualSnapshotSchema.parse(snapshot)
  const plan = result.plans[0]
  return [
    `Proposed annual leave: ${result.input.year}`,
    ...plan.breaks.flatMap((item) => [
      `Break ${result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1}: ${item.window.start_date} through ${item.window.end_date} (inclusive)`,
      `Vacation days required: ${item.window.vacation_days_used}`,
      `Working dates: ${item.charged_dates.join(', ') || 'none'}`,
    ]),
    `Total vacation days required: ${plan.accounting.total_leave_used}`,
    ...(plan.fulfillment === 'reduced'
      ? [
          `Reduced plan: ${plan.breaks.length} of ${result.input.slots.length} requested breaks`,
          `Not included: ${plan.omitted_slot_ids
            .map((id) => {
              const index = result.input.slots.findIndex((slot) => slot.slot_id === id)
              const slot = result.input.slots[index]
              return `Break ${index + 1} (${slot.min_days}–${slot.max_days} days)`
            })
            .join(', ')}`,
        ]
      : []),
    ...(includeBudget
      ? [
          `Available: ${plan.accounting.available_days}; used: ${plan.accounting.total_leave_used}; remaining: ${plan.accounting.remaining_days}; protected reserve: ${plan.accounting.reserve_days}; unallocated: ${plan.accounting.unallocated_days}.`,
        ]
      : []),
    `Calculated: ${result.calculation_context.calculated_at}`,
    'Planning snapshot; not an approval or a synchronized calendar.',
  ].join('\n')
}

export function annualCalendarFile(
  snapshot: AnnualSnapshot,
  title = 'Proposed annual vacation',
  includeBudget = false,
  timestamp = new Date(),
): string {
  const { result } = annualSnapshotSchema.parse(snapshot)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vacation Window Planner//EN',
    ...result.plans[0].breaks.flatMap((item) => {
      const end = new Date(`${item.window.end_date}T00:00:00Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      if (end.getUTCFullYear() > 9999)
        throw new Error('Calendar end cannot be represented. Copy the request instead.')
      return [
        'BEGIN:VEVENT',
        `UID:${snapshot.capture_id}-${item.window.start_date}-${item.window.end_date}@vacation-window-planner`,
        `DTSTAMP:${timestamp
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${item.window.start_date.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
        `SUMMARY:${escapeText(title)}`,
        `DESCRIPTION:${escapeText(annualLeaveRequestText(snapshot, includeBudget))}`,
        'STATUS:TENTATIVE',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      ]
    }),
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n')
}
