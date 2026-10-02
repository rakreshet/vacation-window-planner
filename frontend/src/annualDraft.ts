import type { AnnualResult } from './savedAnnualPlans'
import { planningFromSession } from './planning'
import { annualRequestSchema, type AnnualRequest } from './annualContracts'
import type { DateRange } from './api'
import type { PlanningDraft } from './planning'

export type AnnualSlotDraft = {
  id: string
  minimum: string
  maximum: string
  dates?: DateRange
}
export type AnnualDraft = {
  planning: PlanningDraft
  year: string
  reserve: string
  gap: string
  months: number[]
  slots: AnnualSlotDraft[]
  editingSlotId?: string
}

export function newAnnualDraft(planning: PlanningDraft): AnnualDraft {
  const timeZone =
    planning.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
  const localYear = Number(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone,
    }).format(new Date()),
  )
  return {
    planning: structuredClone({ ...planning, timeZone, allowedNegative: '0' }),
    year: String(localYear + 1),
    reserve: '0',
    gap: '7',
    months: Array.from({ length: 12 }, (_, index) => index + 1),
    slots: [
      { id: 'long', minimum: '7', maximum: '14' },
      { id: 'short-1', minimum: '3', maximum: '5' },
      { id: 'short-2', minimum: '3', maximum: '5' },
    ],
  }
}

export class AnnualDraftError extends Error {
  constructor(
    message: string,
    readonly fields: string[],
  ) {
    super(message)
  }
}

export function annualInput(draft: AnnualDraft): AnnualRequest {
  if (draft.editingSlotId)
    throw new AnnualDraftError('Keep or cancel the exact dates before calculating', [
      `slots.${draft.slots.findIndex((slot) => slot.id === draft.editingSlotId)}`,
    ])
  if (draft.planning.calendarEditor)
    throw new AnnualDraftError('Apply or cancel the calendar rule before calculating', [
      'context.personal_calendar',
    ])
  if (draft.planning.pendingCountry)
    throw new AnnualDraftError('Keep or clear date overrides before calculating', [
      'context.country_code',
    ])
  const notice = draft.planning.personalCalendar?.minimum_notice_days ?? 0
  if (!Number.isInteger(notice) || notice < 0 || notice > 90)
    throw new AnnualDraftError('Minimum notice must be a whole number from 0 to 90', [
      'context.personal_calendar.minimum_notice_days',
    ])
  const balance = Number(draft.planning.balance)
  if (!draft.planning.balance || !Number.isInteger(balance) || balance < 0 || balance > 366)
    throw new AnnualDraftError('Enter available leave from 0 to 366 whole days', [
      'context.balance_days',
    ])
  const input = annualRequestSchema.safeParse({
    year: Number(draft.year),
    reserve_days: Number(draft.reserve),
    minimum_gap_days: Number(draft.gap),
    allowed_start_months: draft.months,
    slots: draft.slots.map((slot) => ({
      slot_id: slot.id,
      min_days: Number(slot.minimum),
      max_days: Number(slot.maximum),
      locked_dates: slot.dates ?? null,
    })),
  })
  if (!input.success || !draft.year || !draft.reserve || !draft.gap) {
    const fields = !input.success
      ? input.error.issues.map((issue) => {
          const path = issue.path.join('.')
          if (/^slots\.\d+$/.test(path)) return `${path}.min_days`
          return path || 'allowed_start_months'
        })
      : [!draft.year ? 'year' : !draft.reserve ? 'reserve_days' : 'minimum_gap_days']
    throw new AnnualDraftError('Check the year, reserve, start months and break lengths', [
      ...new Set(fields),
    ])
  }
  if (
    Number(draft.planning.balance) > 366 ||
    input.data.reserve_days > Number(draft.planning.balance)
  )
    throw new AnnualDraftError('Reserve must fit within an available balance of 0 to 366 days', [
      Number(draft.planning.balance) > 366 ? 'context.balance_days' : 'reserve_days',
    ])
  return input.data
}

export function draftFromAnnual(result: AnnualResult): AnnualDraft {
  return {
    planning: planningFromSession(result.calculation_context.planning),
    year: String(result.input.year),
    reserve: String(result.input.reserve_days),
    gap: String(result.input.minimum_gap_days),
    months: [...result.input.allowed_start_months],
    slots: result.input.slots.map((slot) => ({
      id: slot.slot_id,
      minimum: String(slot.min_days),
      maximum: String(slot.max_days),
      dates: slot.locked_dates ? { ...slot.locked_dates } : undefined,
    })),
  }
}
