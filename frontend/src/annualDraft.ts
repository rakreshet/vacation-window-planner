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

export function annualInput(draft: AnnualDraft): AnnualRequest {
  if (draft.editingSlotId) throw new Error('Keep or cancel the exact dates before calculating')
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
  if (!input.success || !draft.year || !draft.reserve || !draft.gap)
    throw new Error('Check the year, reserve, start months and break lengths')
  if (
    Number(draft.planning.balance) > 366 ||
    input.data.reserve_days > Number(draft.planning.balance)
  )
    throw new Error('Reserve must fit within an available balance of 0 to 366 days')
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
