import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { annualFixture } from './annualFixtures'
import { annualRunSchema } from './annualContracts'
import { createAnnualSnapshot } from './savedAnnualPlans'
import { annualLeaveRequestText } from './annualLeaveRequest'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

test('annual leave text includes exact charged dates and aggregate cost with private budget', async () => {
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  const copy = annualLeaveRequestText(snapshot)
  expect(copy).toContain('Total vacation days required: 8')
  expect(copy).toContain('Working dates: 2027-03-07, 2027-03-08')
  expect(copy).not.toMatch(/reserve|available|remaining/i)
  expect(copy).not.toContain('2027-05-09')
})

test('reduced leave requests disclose omissions and include budget only when requested', async () => {
  const fixture = annualFixture()
  const plan = fixture.plans[0]
  const run = annualRunSchema.parse({
    ...fixture,
    status: 'infeasible',
    full_mix_feasibility: 'infeasible',
    conflicts: [{ code: 'mix_constraints', slot_ids: ['long', 'short-1', 'short-2'] }],
    plans: [
      {
        ...plan,
        fulfillment: 'reduced',
        retained_slot_ids: ['short-1', 'short-2'],
        omitted_slot_ids: ['long'],
        breaks: plan.breaks.slice(0, 2),
        accounting: {
          ...plan.accounting,
          total_leave_used: 3,
          remaining_days: 15,
          unallocated_days: 12,
          total_days_away: 8,
          charged_dates: ['2027-03-07', '2027-03-08', '2027-05-10'],
        },
      },
    ],
  })
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  expect(annualLeaveRequestText(snapshot)).toContain('Reduced plan: 2 of 3 requested breaks')
  expect(annualLeaveRequestText(snapshot)).toContain('Not included: Break 1 (7–14 days)')
  expect(annualLeaveRequestText(snapshot, true)).toContain(
    'Available: 18; used: 3; remaining: 15; protected reserve: 3; unallocated: 12.',
  )
})
