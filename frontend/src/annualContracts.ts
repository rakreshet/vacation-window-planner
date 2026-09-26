import { inclusiveCalendarDays } from './calendarDays'
import { z } from 'zod'

const day = z.iso.date()
const count = z.number().int().nonnegative()
const dates = z
  .strictObject({ start_date: day, end_date: day })
  .refine((value) => value.start_date <= value.end_date)
export const annualSlotSchema = z
  .strictObject({
    slot_id: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
    min_days: count.min(1).max(28),
    max_days: count.min(1).max(28),
    locked_dates: dates.nullable(),
  })
  .refine((slot) => {
    if (slot.min_days > slot.max_days) return false
    if (!slot.locked_dates) return slot.min_days >= 3
    const length = inclusiveCalendarDays(slot.locked_dates.start_date, slot.locked_dates.end_date)
    return (
      length >= slot.min_days &&
      length <= slot.max_days &&
      (slot.min_days >= 3 || (slot.min_days === length && slot.max_days === length))
    )
  }, 'Dates must fit the chosen break length')
export const annualRequestSchema = z
  .strictObject({
    year: count.min(1).max(9999),
    reserve_days: count.max(366),
    slots: z.array(annualSlotSchema).min(1).max(6),
    allowed_start_months: z.array(count.min(1).max(12)).max(12),
    minimum_gap_days: count.max(60),
  })
  .refine(
    (input) =>
      new Set(input.slots.map((slot) => slot.slot_id)).size === input.slots.length &&
      new Set(input.allowed_start_months).size === input.allowed_start_months.length &&
      (input.allowed_start_months.length > 0 || input.slots.every((slot) => slot.locked_dates)),
    'Choose unique slots and start months for new breaks',
  )
export const annualDaySchema = z.strictObject({
  date: day,
  charged: z.boolean(),
  kind: z.enum([
    'extra_working_day',
    'personal_day_off',
    'public_holiday',
    'weekend',
    'ordinary_working',
  ]),
  is_public_holiday: z.boolean(),
  is_weekend: z.boolean(),
  unavailable: z.boolean(),
})
export const annualContextSchema = z.strictObject({
  accounting_version: z.literal('phase075-v1'),
  calculated_at: z.iso.datetime({ offset: true }),
  local_today: day,
  planning: z.strictObject({
    balance_days: count.max(366),
    allowed_negative_days: z.literal(0),
    country_code: z.enum(['IL', 'US', 'GB']),
    weekend_days: z.array(count.max(6)).max(7),
    time_zone: z
      .string()
      .min(1)
      .refine((timeZone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone }).format(new Date(0))
          return true
        } catch {
          return false
        }
      }, 'Choose a supported time zone'),
    personal_calendar: z.strictObject({
      schema_version: z.literal(1),
      minimum_notice_days: count.max(90),
      unavailable_ranges: z.array(dates).max(100),
      date_overrides: z
        .array(
          z.strictObject({
            start_date: day,
            end_date: day,
            kind: z.enum(['extra_working_day', 'personal_day_off']),
          }),
        )
        .max(100),
    }),
  }),
})
export const annualPolicySchema = z.strictObject({
  version: z.literal('annual-v1'),
  candidate_limit: count.min(1).max(12000),
  state_limit: count.min(1).max(500000),
  transition_limit: count.min(1).max(5000000),
  time_limit_seconds: count.min(1).max(5),
})
export const annualBreakSchema = z.strictObject({
  slot_id: z.string(),
  locked: z.boolean(),
  notice_waived: z.boolean(),
  balance_after_break: z.number().int(),
  window: z.strictObject({
    start_date: day,
    end_date: day,
    total_days: count.min(1).max(28),
    vacation_days_used: count.max(28),
    holiday_dates: z.array(day).max(28),
  }),
  charged_dates: z.array(day).max(28),
  day_details: z.array(annualDaySchema).min(1).max(28),
})
export const annualPlanSchema = z
  .strictObject({
    plan_id: z.string().regex(/^[a-f0-9]{64}$/),
    objective: z.enum(['most_days_away', 'fewer_leave_days', 'different_dates']),
    fulfillment: z.enum(['full', 'reduced']),
    retained_slot_ids: z.array(z.string()).min(1).max(6),
    omitted_slot_ids: z.array(z.string()).max(5),
    breaks: z.array(annualBreakSchema).min(1).max(6),
    accounting: z.strictObject({
      available_days: count.max(366),
      reserve_days: count.max(366),
      spendable_days: count.max(366),
      total_leave_used: count.max(168),
      remaining_days: count.max(366),
      unallocated_days: count.max(366),
      total_days_away: count.min(1).max(168),
      charged_dates: z.array(day).max(168),
    }),
  })
  .refine((plan) => {
    const pool = plan.accounting
    const charged = plan.breaks.flatMap((item) => item.charged_dates)
    let remaining = pool.available_days
    return (
      pool.reserve_days <= pool.available_days &&
      pool.spendable_days === pool.available_days - pool.reserve_days &&
      pool.total_leave_used <= pool.spendable_days &&
      pool.remaining_days === pool.available_days - pool.total_leave_used &&
      pool.unallocated_days === pool.remaining_days - pool.reserve_days &&
      pool.total_leave_used === charged.length &&
      new Set(charged).size === charged.length &&
      JSON.stringify(pool.charged_dates) === JSON.stringify(charged) &&
      pool.total_days_away === plan.breaks.reduce((sum, item) => sum + item.window.total_days, 0) &&
      plan.breaks.every((item, index) => {
        remaining -= item.window.vacation_days_used
        const length = inclusiveCalendarDays(item.window.start_date, item.window.end_date)
        return (
          remaining === item.balance_after_break &&
          (!index || item.window.start_date > plan.breaks[index - 1].window.end_date) &&
          item.window.total_days === length &&
          item.day_details.length === length &&
          item.day_details.every(
            (day, offset) =>
              Date.parse(day.date) === Date.parse(item.window.start_date) + offset * 86400000,
          ) &&
          item.window.vacation_days_used === item.charged_dates.length &&
          JSON.stringify(item.charged_dates) ===
            JSON.stringify(item.day_details.filter((day) => day.charged).map((day) => day.date))
        )
      })
    )
  }, 'Annual accounting is inconsistent')

const conflictFields = { slot_ids: z.array(z.string()).min(1).max(6) }
const annualConflictSchema = z.discriminatedUnion('code', [
  z.strictObject({
    ...conflictFields,
    code: z.literal('locked_budget'),
    required_days: count,
    permitted_days: count,
  }),
  z.strictObject({
    ...conflictFields,
    code: z.literal('mix_budget'),
    required_days: count,
    permitted_days: count,
  }),
  z.strictObject({ ...conflictFields, code: z.literal('locked_overlap') }),
  z.strictObject({
    ...conflictFields,
    code: z.literal('locked_unavailable'),
    dates: z.array(day).max(28),
  }),
  z.strictObject({
    ...conflictFields,
    code: z.literal('locked_spacing'),
    gap_days: count,
    minimum_gap_days: count.max(60),
    working_dates_between: count,
  }),
  z.strictObject({ ...conflictFields, code: z.literal('mix_constraints') }),
])
const limitReason = z.enum(['candidate_limit', 'state_limit', 'transition_limit', 'deadline'])
const common = {
  run_id: z.uuid(),
  input: annualRequestSchema,
  calculation_context: annualContextSchema,
  policy: annualPolicySchema,
  counters: z.strictObject({ candidates: count, states: count, transitions: count }),
  limit_reason: limitReason.nullable(),
  locked_assessments: z.array(annualBreakSchema).max(6),
  year_calendar: z.array(annualDaySchema).max(366),
}
export const annualRunSchema = z
  .discriminatedUnion('status', [
    z.strictObject({
      ...common,
      status: z.literal('complete'),
      full_mix_feasibility: z.literal('feasible'),
      plans: z.array(annualPlanSchema).min(1).max(3),
      conflicts: z.array(annualConflictSchema).max(0),
    }),
    z.strictObject({
      ...common,
      status: z.literal('infeasible'),
      full_mix_feasibility: z.literal('infeasible'),
      plans: z.array(annualPlanSchema).max(3),
      conflicts: z.array(annualConflictSchema).min(1),
    }),
    z.strictObject({
      ...common,
      status: z.literal('conflict'),
      full_mix_feasibility: z.literal('not_evaluated'),
      plans: z.array(annualPlanSchema).max(0),
      conflicts: z.array(annualConflictSchema).min(1),
    }),
    z.strictObject({
      ...common,
      status: z.literal('too_broad'),
      full_mix_feasibility: z.literal('unknown'),
      plans: z.array(annualPlanSchema).max(0),
      conflicts: z.array(annualConflictSchema),
      limit_reason: limitReason,
    }),
  ])
  .refine(
    (run) =>
      run.plans.every((plan) => {
        const selectedIds = plan.breaks.map((item) => item.slot_id)
        const selected = new Set(selectedIds)
        const retained = run.input.slots
          .filter((slot) => selected.has(slot.slot_id))
          .map((slot) => slot.slot_id)
        const omitted = run.input.slots
          .filter((slot) => !selected.has(slot.slot_id))
          .map((slot) => slot.slot_id)
        return (
          selected.size === selectedIds.length &&
          JSON.stringify(retained) === JSON.stringify(plan.retained_slot_ids) &&
          JSON.stringify(omitted) === JSON.stringify(plan.omitted_slot_ids) &&
          (plan.fulfillment === 'reduced') === omitted.length > 0 &&
          (run.status === 'infeasible') === (plan.fulfillment === 'reduced') &&
          plan.accounting.available_days === run.calculation_context.planning.balance_days &&
          plan.accounting.reserve_days === run.input.reserve_days &&
          run.input.slots.every((slot) => !slot.locked_dates || selected.has(slot.slot_id)) &&
          plan.breaks.every((item) => {
            const slot = run.input.slots.find((slot) => slot.slot_id === item.slot_id)
            return (
              slot &&
              item.window.total_days >= slot.min_days &&
              item.window.total_days <= slot.max_days &&
              item.locked === Boolean(slot.locked_dates) &&
              (!slot.locked_dates ||
                (item.window.start_date === slot.locked_dates.start_date &&
                  item.window.end_date === slot.locked_dates.end_date)) &&
              item.window.start_date.startsWith(`${run.input.year}-`) &&
              item.window.end_date.startsWith(`${run.input.year}-`)
            )
          })
        )
      }),
    'Annual fulfillment does not match the request',
  )

export type AnnualRequest = z.infer<typeof annualRequestSchema>
export type AnnualRun = z.infer<typeof annualRunSchema>
export type AnnualPlan = z.infer<typeof annualPlanSchema>
export type AnnualBreak = z.infer<typeof annualBreakSchema>
export type AnnualConflict = z.infer<typeof annualConflictSchema>
