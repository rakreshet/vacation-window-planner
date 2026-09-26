import { z } from 'zod'
import type { ActionSnapshot } from './actionSnapshots'

const date = z.iso.date()
const count = z.number().int().nonnegative()
const range = z
  .object({ start_date: date, end_date: date })
  .refine((value) => value.start_date <= value.end_date)
const dateOverride = z
  .object({
    start_date: date,
    end_date: date,
    kind: z.enum(['personal_day_off', 'extra_working_day']),
  })
  .refine((value) => value.start_date <= value.end_date)
const windowSchema = z.object({
  start_date: date,
  end_date: date,
  total_days: count.min(1).max(6000),
  vacation_days_used: count.max(6000),
  holiday_dates: z.array(date).max(6000),
})
const reason = z.discriminatedUnion('code', [
  z.object({ code: z.literal('unavailable_dates'), dates: z.array(date).max(6000) }),
  z.object({ code: z.literal('insufficient_notice'), earliest_start_date: date }),
  z.object({ code: z.literal('over_budget'), required_days: count, permitted_days: count }),
])
export const actionSnapshotSchema: z.ZodType<ActionSnapshot> = z
  .object({
    schema_version: z.literal(1),
    capture_id: z.string().regex(/^[a-f0-9]{64}$/),
    export_uid: z.string(),
    source: z.enum(['search', 'opportunity', 'comparison_baseline', 'comparison_alternative']),
    metadata: z.object({
      explanation: z.string().optional(),
      policy_version: z.string().optional(),
    }),
    window: windowSchema,
    assessment: z.object({
      window: windowSchema,
      charged_dates: z.array(date).max(6000),
      remaining_balance: z.number().int(),
      eligible: z.boolean(),
      eligibility_reasons: z.array(reason).max(3),
      warnings: z.array(z.enum(['full_balance', 'negative_balance'])).max(2),
      day_details: z
        .array(
          z.object({
            date,
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
          }),
        )
        .max(6000),
    }),
    context: z.object({
      accounting_version: z.literal('phase075-v1'),
      calculated_at: z.iso.datetime({ offset: true }),
      local_today: date,
      planning: z.object({
        balance_days: count,
        allowed_negative_days: count,
        country_code: z.string().min(2).max(10),
        time_zone: z.string().refine((value) => {
          try {
            new Intl.DateTimeFormat('en', { timeZone: value })
            return true
          } catch {
            return false
          }
        }),
        weekend_days: z.array(count.max(6)).max(7),
        personal_calendar: z.object({
          schema_version: z.literal(1),
          minimum_notice_days: count.max(90),
          date_overrides: z.array(dateOverride).max(100),
          unavailable_ranges: z.array(range).max(100),
        }),
      }),
    }),
  })
  .refine((value) => {
    const { window, assessment } = value
    const length = (Date.parse(window.end_date) - Date.parse(window.start_date)) / 86400000 + 1
    return (
      window.total_days === length &&
      window.vacation_days_used <= length &&
      JSON.stringify(window) === JSON.stringify(assessment.window) &&
      assessment.day_details.length === length &&
      assessment.day_details.every(
        (day, index) => Date.parse(day.date) === Date.parse(window.start_date) + index * 86400000,
      ) &&
      JSON.stringify(assessment.charged_dates) ===
        JSON.stringify(
          assessment.day_details.filter((day) => day.charged).map((day) => day.date),
        ) &&
      assessment.charged_dates.length === window.vacation_days_used &&
      value.export_uid === `${value.capture_id}@vacation-window-planner`
    )
  }, 'Snapshot accounting is incomplete or inconsistent')

export const savedOptionSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().trim().min(1).max(80),
  saved_at: z.iso.datetime({ offset: true }),
  snapshot: actionSnapshotSchema,
})
