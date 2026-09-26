import type { SessionInput, PersonalCalendar } from './api'

export type PlanningDraft = {
  balance: string
  allowedNegative: string
  country: string
  weekendDays: number[]
  personalCalendar?: PersonalCalendar
  pendingCountry?: string
  calendarEditor?: {
    original?: { index: number; unavailable: boolean }
    start_date: string
    end_date: string
    kind: 'personal_day_off' | 'extra_working_day' | 'unavailable'
  }
  timeZone?: string
}

export const emptyPlanning: PlanningDraft = {
  balance: '',
  allowedNegative: '0',
  country: 'IL',
  weekendDays: [4, 5],
}

export function changePlanningCountry(draft: PlanningDraft, country: string): PlanningDraft {
  if (country !== draft.country && draft.personalCalendar?.date_overrides.length) {
    return { ...draft, pendingCountry: country }
  }
  const previousDefault = draft.country === 'IL' ? [4, 5] : [5, 6]
  const followsDefault =
    draft.weekendDays.length === previousDefault.length &&
    previousDefault.every((day) => draft.weekendDays.includes(day))
  return {
    ...draft,
    country,
    weekendDays: followsDefault ? (country === 'IL' ? [4, 5] : [5, 6]) : draft.weekendDays,
  }
}

export function planningSession(draft: PlanningDraft): SessionInput {
  if (draft.calendarEditor) throw new Error('Apply or cancel the calendar rule before calculating')
  if (draft.pendingCountry) throw new Error('Keep or clear date overrides before calculating')
  const personal = draft.personalCalendar ?? emptyPersonalCalendar()
  if (
    !Number.isInteger(personal.minimum_notice_days) ||
    personal.minimum_notice_days < 0 ||
    personal.minimum_notice_days > 90
  )
    throw new Error('Minimum notice must be a whole number from 0 to 90')
  const balance = Number(draft.balance)
  const allowance = Number(draft.allowedNegative)
  if (!draft.balance || !Number.isInteger(balance) || balance < 0) {
    throw new Error('Enter a vacation balance of zero or more whole days')
  }
  if (!Number.isInteger(allowance) || allowance < 0 || allowance > 5) {
    throw new Error('Allowed negative days must be a whole number from 0 to 5')
  }
  return {
    balance_days: balance,
    allowed_negative_days: allowance,
    country_code: draft.country,
    weekend_days: [...draft.weekendDays].sort(),
    time_zone:
      draft.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
    personal_calendar: personal,
  }
}

export function planningFromSession(context: SessionInput): PlanningDraft {
  return {
    balance: String(context.balance_days),
    personalCalendar: context.personal_calendar ?? emptyPersonalCalendar(),
    timeZone: context.time_zone,
    allowedNegative: String(context.allowed_negative_days),
    country: context.country_code,
    weekendDays: [...context.weekend_days],
  }
}

export function resolveCalendarCountry(draft: PlanningDraft, keep: boolean): PlanningDraft {
  if (!draft.pendingCountry) return draft
  const rules = draft.personalCalendar ?? emptyPersonalCalendar()
  const changed = changePlanningCountry(
    { ...draft, personalCalendar: { ...rules, date_overrides: [] } },
    draft.pendingCountry,
  )
  return {
    ...changed,
    pendingCountry: undefined,
    personalCalendar: { ...rules, date_overrides: keep ? rules.date_overrides : [] },
  }
}

export function emptyPersonalCalendar(): PersonalCalendar {
  return { schema_version: 1, date_overrides: [], unavailable_ranges: [], minimum_notice_days: 0 }
}
