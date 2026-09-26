import type { PersonalCalendar } from './api'
import { calendarRuleLabels, type CalendarRuleDraft } from './calendarRules'

type CalendarRuleListProps = {
  calendar: PersonalCalendar
  editing: boolean
  onEdit: (rule: CalendarRuleDraft) => void
  onRemove: (original: CalendarRuleDraft['original']) => void
}

export default function CalendarRuleList({
  calendar,
  editing,
  onEdit,
  onRemove,
}: CalendarRuleListProps) {
  const dateOverrides = calendar.date_overrides.map((rule, index) => ({
    ...rule,
    original: { index, unavailable: false },
  }))
  const unavailableRanges = calendar.unavailable_ranges.map((range, index) => ({
    ...range,
    kind: 'unavailable' as const,
    original: { index, unavailable: true },
  }))
  return (
    <ul>
      {[...dateOverrides, ...unavailableRanges].map((rule) => {
        const label = calendarRuleLabels[rule.kind]
        const actionLabel = rule.kind === 'unavailable' ? 'unavailable' : label
        return (
          <li key={`${rule.original.unavailable}-${rule.original.index}`}>
            {rule.start_date} – {rule.end_date} · {label}
            <button
              type="button"
              disabled={editing}
              aria-label={`Edit ${actionLabel} ${rule.start_date}`}
              onClick={() => onEdit(rule)}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={editing}
              aria-label={`Remove ${actionLabel} ${rule.start_date}`}
              onClick={() => onRemove(rule.original)}
            >
              Remove
            </button>
          </li>
        )
      })}
    </ul>
  )
}
