import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  const options = new Intl.DateTimeFormat().resolvedOptions()
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'Asia/Jerusalem',
  })
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function submitResponse(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : body),
    })),
  )
  render(<AnnualPlanWorkspace initialPlanning={{ ...emptyPlanning, balance: '18' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
}

test.each([
  [
    'conflict',
    'not_evaluated',
    [{ code: 'locked_budget', slot_ids: ['long'], required_days: 16, permitted_days: 15 }],
    'Locked trips use 16 days; only 15 are available after reserve.',
  ],
  ['too_broad', 'unknown', [], 'We could not finish checking this request'],
])(
  'the %s outcome gives precise recovery without declaring a valid plan',
  async (status, feasibility, conflicts, message) => {
    submitResponse({
      ...annualFixture(),
      status,
      full_mix_feasibility: feasibility,
      plans: [],
      conflicts,
      limit_reason: status === 'too_broad' ? 'transition_limit' : null,
    })
    expect(await screen.findByText(String(message), { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(/days remain, including/)).not.toBeInTheDocument()
  },
)

test('reduced plans disclose omitted breaks without changing the requested mix', async () => {
  const result = annualFixture()
  const plan = result.plans[0]
  const reduced = {
    ...result,
    status: 'infeasible',
    full_mix_feasibility: 'infeasible',
    conflicts: [
      {
        code: 'mix_budget',
        slot_ids: ['long', 'short-1', 'short-2'],
        required_days: 8,
        permitted_days: 3,
      },
    ],
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
  }
  submitResponse(reduced)
  expect(await screen.findByText('Reduced plan: 2 of 3 requested breaks')).toBeInTheDocument()
  expect(screen.getByText('Omitted: Break 1')).toBeInTheDocument()
  expect(screen.getAllByRole('group', { name: /^Break \d$/ })).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Use this reduced mix' }))
  expect(screen.getAllByRole('group', { name: /^Break \d$/ })).toHaveLength(2)
  expect(screen.getByText('Last calculation — inputs have changed')).toBeInTheDocument()
  expect(screen.getByText('Omitted: Break 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Use this reduced mix' })).toBeDisabled()
})

test('a response with broken aggregate accounting cannot become a usable result', async () => {
  const broken = annualFixture()
  broken.plans[0].accounting.remaining_days = 99
  submitResponse(broken)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The annual result could not be verified',
  )
  expect(screen.queryByText('8 vacation days used')).not.toBeInTheDocument()
})

test('a complete response cannot mislabel a plan or invent slot assignments', async () => {
  const broken = annualFixture()
  broken.plans[0].fulfillment = 'reduced'
  broken.plans[0].breaks[0].slot_id = 'unrequested'
  submitResponse(broken)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The annual result could not be verified',
  )
})
