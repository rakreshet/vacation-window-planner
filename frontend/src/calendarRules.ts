import type { PersonalCalendar } from './api'
import type { PlanningDraft } from './planning'

export type CalendarRuleDraft = NonNullable<PlanningDraft['calendarEditor']>
export const calendarRuleLabels = {
  personal_day_off: 'Personal day off',
  extra_working_day: 'Extra working day',
  unavailable: 'Unavailable',
}

export function removeCalendarRule(
  calendar: PersonalCalendar,
  original: CalendarRuleDraft['original'],
): PersonalCalendar {
  if (!original) return calendar
  return original.unavailable
    ? {
        ...calendar,
        unavailable_ranges: calendar.unavailable_ranges.filter(
          (_, index) => index !== original.index,
        ),
      }
    : {
        ...calendar,
        date_overrides: calendar.date_overrides.filter((_, index) => index !== original.index),
      }
}

export function applyCalendarRule(
  calendar: PersonalCalendar,
  draft: CalendarRuleDraft,
): PersonalCalendar {
  const remainingRules = removeCalendarRule(calendar, draft.original)
  if (!draft.start_date || !draft.end_date || draft.end_date < draft.start_date) {
    throw new Error('Choose ordered start and end dates.')
  }
  const rangeLength =
    (Date.parse(`${draft.end_date}T00:00:00Z`) - Date.parse(`${draft.start_date}T00:00:00Z`)) /
      86400000 +
    1
  if (rangeLength > 366) throw new Error('A rule may contain at most 366 dates')
  if (
    draft.kind !== 'unavailable' &&
    remainingRules.date_overrides.some(
      (rule) =>
        rule.kind !== draft.kind &&
        rule.start_date <= draft.end_date &&
        draft.start_date <= rule.end_date,
    )
  )
    throw new Error('An opposing date override overlaps this rule')
  const dateRange = { start_date: draft.start_date, end_date: draft.end_date }
  return draft.kind === 'unavailable'
    ? { ...remainingRules, unavailable_ranges: [...remainingRules.unavailable_ranges, dateRange] }
    : {
        ...remainingRules,
        date_overrides: [...remainingRules.date_overrides, { ...dateRange, kind: draft.kind }],
      }
}
