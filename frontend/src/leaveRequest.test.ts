import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { createActionSnapshot } from './actionSnapshots'
import { window, assessment, context } from './snapshotFixtures'
import { leaveRequestText } from './leaveRequest'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

test('zero-leave request text preserves inclusive dates and planning status', async () => {
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  const text = leaveRequestText(snapshot)
  expect(text).toContain('2027-01-07 through 2027-01-09 (inclusive)')
  expect(text).toContain('No vacation days are required under the recorded calendar')
  expect(text).toContain('not an approval')
})

test('leave text includes every eligibility warning but omits unrelated planning context', async () => {
  const blocked = {
    ...assessment,
    eligible: false,
    warnings: ['negative_balance' as const],
    eligibility_reasons: [
      { code: 'unavailable_dates' as const, dates: ['2027-01-08'] },
      { code: 'insufficient_notice' as const, earliest_start_date: '2027-01-10' },
      { code: 'over_budget' as const, required_days: 3, permitted_days: 2 },
    ],
  }
  const snapshot = await createActionSnapshot('comparison_baseline', window, blocked, context)
  const text = leaveRequestText(snapshot)
  expect(text).toContain('Unavailable dates: 2027-01-08')
  expect(text).toContain('Minimum notice requires a start on or after 2027-01-10')
  expect(text).toContain('Exceeds the recorded leave allowance')
  expect(text).toContain('Uses a negative leave balance')
  expect(text).not.toContain('Asia/Jerusalem')
  expect(text).not.toContain('balance_days')
})
