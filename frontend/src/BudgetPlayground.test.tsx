import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
import { budgetFixture } from './budgetFixtures'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(comparison: unknown = budgetFixture(), app = false, annual = annualFixture()) {
  const requests: Array<{ url: string; body: unknown }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
      return {
        ok: true,
        json: async () =>
          url.endsWith('/sessions')
            ? { token: 'token' }
            : url.endsWith('/budget-comparison')
              ? comparison
              : annual,
      }
    }),
  )
  if (app) {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '18' } })
    fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  } else
    render(
      <AnnualPlanWorkspace
        initialPlanning={{
          ...emptyPlanning,
          balance: String(annual.calculation_context.planning.balance_days),
          timeZone: 'Asia/Jerusalem',
        }}
      />,
    )
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  return requests
}

test('budget comparison is explicit and shows three hypothetical budgets without editing the draft', async () => {
  const requests = setup()
  await screen.findByRole('region', { name: 'Your annual plans' })
  expect(requests.filter((request) => request.url.endsWith('/budget-comparison'))).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const comparison = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  expect(comparison.getByRole('heading', { name: '17 available leave days' })).toBeInTheDocument()
  expect(comparison.getByRole('heading', { name: '18 available leave days' })).toBeInTheDocument()
  expect(comparison.getByRole('heading', { name: '19 available leave days' })).toBeInTheDocument()
  expect(comparison.getByText('Current budget')).toBeInTheDocument()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(requests.filter((request) => request.url.endsWith('/budget-comparison'))).toHaveLength(1)
})

test('adopting a completed budget edits only available leave and requires explicit recalculation', async () => {
  const requests = setup()
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const comparison = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  const higher = comparison
    .getByRole('heading', { name: '19 available leave days' })
    .closest('article')!
  fireEvent.click(within(higher).getByRole('button', { name: 'Use this budget' }))
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(19)
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(3)
  expect(screen.getAllByRole('group', { name: /Break \d$/ })).toHaveLength(3)
  expect(screen.getByText('Last calculation — inputs have changed')).toBeInTheDocument()
  expect(requests.filter((request) => request.url.endsWith('/annual-plans'))).toHaveLength(1)
})

test('the playground says honestly when neighboring budgets add no days away', async () => {
  setup()
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const comparison = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  expect(comparison.getAllByText('No additional days away')).toHaveLength(2)
})

test('editing the annual draft invalidates a pending comparison and ignores its late response', async () => {
  let finish: (value: unknown) => void = () => undefined
  const pending = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  setup(pending)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  await screen.findByRole('button', { name: 'Comparing budgets…' })
  fireEvent.change(screen.getByLabelText('Available leave for included trips'), {
    target: { value: '20' },
  })
  await act(async () => {
    finish(budgetFixture())
    await pending
  })
  expect(screen.queryByRole('region', { name: 'Leave budget comparison' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Compare leave budgets' })).toBeDisabled()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(20)
})

test.each(['baseline', 'request', 'context', 'missing', 'objective', 'calendar'])(
  'rejects a comparison with inconsistent %s facts',
  async (fault) => {
    const comparison = budgetFixture()
    if (fault === 'baseline') comparison.baseline_days = 19
    if (fault === 'request') comparison.scenarios[0].outcome.input.minimum_gap_days = 8
    if (fault === 'context') comparison.calculation_context.planning.country_code = 'US'
    if (fault === 'missing') comparison.scenarios.pop()
    if (fault === 'objective')
      comparison.scenarios[0].outcome.plans[0].objective = 'fewer_leave_days'
    if (fault === 'calendar') comparison.scenarios[0].outcome.year_calendar[0].unavailable = true
    setup(comparison)
    await screen.findByRole('region', { name: 'Your annual plans' })
    fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The budget comparison could not be verified',
    )
    expect(
      screen.queryByRole('region', { name: 'Leave budget comparison' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  },
)

test('a capped neighbor is unknown, has no delta or adoption, and keeps completed cards usable', async () => {
  const comparison = budgetFixture()
  Object.assign(comparison.scenarios[2].outcome, {
    status: 'too_broad',
    full_mix_feasibility: 'unknown',
    plans: [],
    limit_reason: 'deadline',
  })
  setup(comparison)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const region = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  const capped = within(
    region.getByRole('heading', { name: '19 available leave days' }).closest('article')!,
  )
  expect(capped.getByText('Comparison unfinished')).toBeInTheDocument()
  expect(capped.getByText(/This budget is still unknown/)).toBeInTheDocument()
  expect(capped.queryByText('No additional days away')).not.toBeInTheDocument()
  expect(capped.queryByRole('button', { name: 'Use this budget' })).not.toBeInTheDocument()
  expect(region.getAllByRole('button', { name: 'Use this budget' })).toHaveLength(2)
})

test('a reduced neighbor names omitted breaks and does not claim a full-mix delta or adoption', async () => {
  const comparison = budgetFixture()
  const outcome = comparison.scenarios[0].outcome
  const plan = outcome.plans[0]
  Object.assign(outcome, {
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
  })
  Object.assign(plan, {
    fulfillment: 'reduced',
    retained_slot_ids: ['short-1', 'short-2'],
    omitted_slot_ids: ['long'],
    breaks: plan.breaks.slice(0, 2),
  })
  Object.assign(plan.accounting, {
    total_leave_used: 3,
    remaining_days: 14,
    unallocated_days: 11,
    total_days_away: 8,
    charged_dates: ['2027-03-07', '2027-03-08', '2027-05-10'],
  })
  setup(comparison)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const region = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  const reduced = within(
    region.getByRole('heading', { name: '17 available leave days' }).closest('article')!,
  )
  expect(reduced.getByText('Reduced mix: 2 of 3 breaks')).toBeInTheDocument()
  expect(reduced.getByText('Omitted: Break 1')).toBeInTheDocument()
  expect(reduced.queryByText(/fewer days away/)).not.toBeInTheDocument()
  expect(reduced.queryByRole('button', { name: 'Use this budget' })).not.toBeInTheDocument()
})

test('a full-mix improvement shows the actual changed dates alongside its days-away gain', async () => {
  const comparison = budgetFixture()
  const plan = comparison.scenarios[2].outcome.plans[0]
  const august = plan.breaks[2]
  august.window.end_date = '2027-08-15'
  august.window.total_days = 10
  august.window.vacation_days_used = 6
  august.charged_dates.push('2027-08-15')
  august.day_details.push(
    comparison.scenarios[2].outcome.year_calendar.find((day) => day.date === '2027-08-15')!,
  )
  august.balance_after_break = 10
  Object.assign(plan.accounting, {
    total_leave_used: 9,
    remaining_days: 10,
    unallocated_days: 7,
    total_days_away: 18,
  })
  plan.accounting.charged_dates.push('2027-08-15')
  setup(comparison)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const region = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  const higher = within(
    region.getByRole('heading', { name: '19 available leave days' }).closest('article')!,
  )
  expect(higher.getByText('1 more day away')).toBeInTheDocument()
  expect(higher.getByText('2027-08-06 – 2027-08-15')).toBeInTheDocument()
  expect(higher.getByText('Break 1: dates changed')).toBeInTheDocument()
})

test('leaving the annual view invalidates a pending comparison while preserving the draft', async () => {
  let finish: (value: unknown) => void = () => undefined
  const pending = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  setup(pending, true)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  await screen.findByRole('button', { name: 'Comparing budgets…' })
  fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
  await act(async () => {
    finish(budgetFixture())
    await pending
  })
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  expect(screen.queryByRole('region', { name: 'Leave budget comparison' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(screen.getByRole('button', { name: 'Compare leave budgets' })).toBeEnabled()
})

test('a locked-budget conflict reports the required leave after reserve without offering adoption', async () => {
  const comparison = budgetFixture()
  Object.assign(comparison.scenarios[0].outcome, {
    status: 'conflict',
    full_mix_feasibility: 'not_evaluated',
    plans: [],
    conflicts: [
      { code: 'locked_budget', slot_ids: ['long'], required_days: 15, permitted_days: 14 },
    ],
  })
  setup(comparison)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const region = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  const lower = within(
    region.getByRole('heading', { name: '17 available leave days' }).closest('article')!,
  )
  expect(
    lower.getByText('Locked trips use 15 days; only 14 are available after reserve.'),
  ).toBeInTheDocument()
  expect(lower.queryByRole('button', { name: 'Use this budget' })).not.toBeInTheDocument()
})

test('the maximum budget explains why a higher neighbor is unavailable', async () => {
  const annual = annualFixture()
  annual.calculation_context.planning.balance_days = 366
  const plan = annual.plans[0]
  Object.assign(plan.accounting, {
    available_days: 366,
    spendable_days: 363,
    remaining_days: 358,
    unallocated_days: 355,
  })
  plan.breaks.forEach((item) => {
    item.balance_after_break += 348
  })
  setup(budgetFixture(366), false, annual)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  const region = within(await screen.findByRole('region', { name: 'Leave budget comparison' }))
  expect(region.getAllByRole('article')).toHaveLength(2)
  expect(
    region.getByText('A higher budget is unavailable: 366 days is the maximum.'),
  ).toBeInTheDocument()
})

test('an unavailable comparison can be retried explicitly without changing the annual result', async () => {
  setup(null)
  await screen.findByRole('region', { name: 'Your annual plans' })
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  await screen.findByRole('alert')
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => budgetFixture() } as Response)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token: 'retry' }),
  } as Response)
  fireEvent.click(screen.getByRole('button', { name: 'Compare leave budgets' }))
  await screen.findByRole('region', { name: 'Leave budget comparison' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(screen.getByRole('region', { name: 'Your annual plans' })).toBeInTheDocument()
})
