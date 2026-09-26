import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createActionSnapshot } from './actionSnapshots'
import type { CalculationContext, WindowAssessment } from './api'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

const window = {
  start_date: '2027-01-07',
  end_date: '2027-01-09',
  total_days: 3,
  vacation_days_used: 0,
  holiday_dates: [],
}
const assessment: WindowAssessment = {
  window,
  charged_dates: [],
  remaining_balance: 8,
  eligible: true,
  eligibility_reasons: [],
  warnings: [],
  day_details: [
    {
      date: '2027-01-07',
      charged: false,
      kind: 'personal_day_off',
      is_public_holiday: false,
      is_weekend: false,
      unavailable: false,
    },
    {
      date: '2027-01-08',
      charged: false,
      kind: 'weekend',
      is_public_holiday: false,
      is_weekend: true,
      unavailable: false,
    },
    {
      date: '2027-01-09',
      charged: false,
      kind: 'weekend',
      is_public_holiday: false,
      is_weekend: true,
      unavailable: false,
    },
  ],
}
const context: CalculationContext = {
  accounting_version: 'phase075-v1',
  calculated_at: '2026-09-26T12:00:00Z',
  local_today: '2026-09-26',
  planning: {
    balance_days: 8,
    allowed_negative_days: 0,
    country_code: 'IL',
    weekend_days: [4, 5],
    time_zone: 'Asia/Jerusalem',
    personal_calendar: {
      schema_version: 1,
      minimum_notice_days: 0,
      unavailable_ranges: [],
      date_overrides: [
        { start_date: '2027-01-07', end_date: '2027-01-07', kind: 'personal_day_off' },
      ],
    },
  },
}

test('the same exact accounting has one identity across surfaces and calculation timestamps', async () => {
  const first = await createActionSnapshot('search', window, assessment, context)
  const second = await createActionSnapshot('comparison_baseline', window, assessment, {
    ...context,
    calculated_at: '2026-09-26T13:00:00Z',
  })
  expect(first.capture_id).toBe(second.capture_id)
  expect(first.export_uid).toBe(second.export_uid)
  expect(first.assessment.charged_dates).toEqual([])
  expect(first.context.planning.time_zone).toBe('Asia/Jerusalem')
})

test('capturing a grouped alternative requires that exact assessment', async () => {
  const alternative = { ...window, start_date: '2027-01-14', end_date: '2027-01-16' }
  await expect(createActionSnapshot('search', alternative, assessment, context)).rejects.toThrow(
    'Accounting does not match the selected dates',
  )
})

test('capture copies accounting before hashing and strips ownership metadata', async () => {
  const mutableAssessment = structuredClone(assessment)
  const suppliedContext = {
    ...context,
    session_id: 'private-id',
    planning: { ...context.planning, token: 'secret' },
  }
  const pending = createActionSnapshot('search', window, mutableAssessment, suppliedContext)
  mutableAssessment.remaining_balance = 1
  const captured = await pending
  expect(captured.assessment.remaining_balance).toBe(8)
  expect(JSON.stringify(captured)).not.toContain('secret')
  expect(JSON.stringify(captured)).not.toContain('private-id')
})

test('capture retains descriptive metadata without changing identity', async () => {
  const original = await createActionSnapshot('search', window, assessment, context)
  const described = await createActionSnapshot('opportunity', window, assessment, context, {
    explanation: 'A longer break',
    policy_version: 'opportunity-v1',
  })
  expect(described.capture_id).toBe(original.capture_id)
  expect(described.metadata.explanation).toBe('A longer break')
  const changed = await createActionSnapshot('search', window, assessment, {
    ...context,
    planning: { ...context.planning, balance_days: 9 },
  })
  expect(changed.capture_id).not.toBe(original.capture_id)
})
