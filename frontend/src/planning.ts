import type { SessionInput } from './api'

export type PlanningDraft = {
  balance: string
  allowedNegative: string
  country: string
  weekendDays: number[]
}

export const emptyPlanning: PlanningDraft = {
  balance: '',
  allowedNegative: '0',
  country: 'IL',
  weekendDays: [4, 5],
}

export function changePlanningCountry(draft: PlanningDraft, country: string): PlanningDraft {
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
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  }
}

export function planningFromSession(context: SessionInput): PlanningDraft {
  return {
    balance: String(context.balance_days),
    allowedNegative: String(context.allowed_negative_days),
    country: context.country_code,
    weekendDays: [...context.weekend_days],
  }
}
