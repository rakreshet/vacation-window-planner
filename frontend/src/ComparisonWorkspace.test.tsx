import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ComparisonWorkspace from './ComparisonWorkspace'
import type { ComparisonDraft } from './ComparisonWorkspace'
import type { ComparisonResponse } from './api'

const response: ComparisonResponse = {
  comparison_id: 'id',
  baseline: {
    window: {
      start_date: '2027-01-03',
      end_date: '2027-01-07',
      total_days: 5,
      vacation_days_used: 5,
      holiday_dates: [],
    },
    charged_dates: ['2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07'],
    weekend_dates: [],
    remaining_balance: 3,
    feasible: true,
    warnings: [],
  },
  save_leave: [],
  longer_break: [],
  policy: {
    version: 'v1',
    shift_days: 21,
    extra_days: 7,
    max_length_days: 28,
    result_limit: 3,
    generation_cap: 2000,
  },
  notices: [],
}
response.save_leave = [
  {
    evaluation: {
      ...response.baseline,
      window: {
        ...response.baseline.window,
        start_date: '2027-01-01',
        end_date: '2027-01-05',
        vacation_days_used: 3,
      },
      charged_dates: ['2027-01-03', '2027-01-04', '2027-01-05'],
      weekend_dates: ['2027-01-01', '2027-01-02'],
      remaining_balance: 5,
    },
    delta: { extra_days: 0, vacation_days_saved: 2, start_shift_days: -2, end_shift_days: -2 },
    explanation: 'Same length, two fewer vacation days.',
  },
]
function Harness() {
  const [draft, setDraft] = useState<ComparisonDraft>({
    dates: { start_date: '2027-01-03', end_date: '2027-01-07' },
    planning: { balance: '8', allowedNegative: '0', country: 'IL', weekendDays: [4, 5] },
  })
  return <ComparisonWorkspace draft={draft} onDraftChange={setDraft} onClose={() => {}} />
}
function setup(value = response) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => (String(input).endsWith('/sessions') ? { token: 'token' } : value),
  }))
  vi.stubGlobal('fetch', fetch)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Compare dates' }))
  return fetch
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('selecting a saving keeps the baseline and explains exact charged days', async () => {
  setup()
  fireEvent.click(
    await screen.findByRole('button', { name: /Same 5 days off, 2 fewer vacation days/ }),
  )
  const baseline = within(screen.getByRole('region', { name: 'Your dates' }))
  expect(baseline.getByText(/vacation days used/)).toHaveTextContent('5 vacation days used')
  const selected = within(screen.getByRole('region', { name: 'Selected alternative' }))
  expect(selected.getByRole('row', { name: 'Vacation days used 5 3' })).toBeInTheDocument()
  expect(selected.getByText(/Starts 2 days earlier/)).toBeInTheDocument()
  expect(selected.getByLabelText('Jan 1, 2027: Weekend')).toBeInTheDocument()
  expect(selected.getByLabelText('Jan 3, 2027: Vacation day')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Keep my dates' }))
  expect(screen.queryByRole('region', { name: 'Selected alternative' })).not.toBeInTheDocument()
})

test('shifting preserves length and hides stale suggestions until explicit update', async () => {
  const fetch = setup()
  await screen.findByRole('button', { name: /Same 5 days off/ })
  fireEvent.click(screen.getByRole('button', { name: 'Move 1 day later' }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2027-01-04')
  expect(screen.getByLabelText('End date')).toHaveValue('2027-01-08')
  expect(screen.getByRole('region', { name: 'Your dates' })).toHaveTextContent('Jan 3, 2027')
  expect(screen.queryByRole('button', { name: /Same 5 days off/ })).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-10' } })
  expect(screen.getByLabelText('Start date')).toHaveValue('2027-01-04')
  fireEvent.click(screen.getByRole('button', { name: 'Update comparison' }))
  await screen.findByRole('button', { name: /Same 5 days off/ })
  expect(fetch).toHaveBeenCalledTimes(4)
  fireEvent.click(screen.getByRole('button', { name: 'Reset original dates' }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2027-01-03')
  expect(screen.getByLabelText('End date')).toHaveValue('2027-01-07')
})

test('no improvement explains the limit and an over-budget baseline remains visible', async () => {
  setup({
    ...response,
    save_leave: [],
    baseline: {
      ...response.baseline,
      feasible: false,
      remaining_balance: -3,
      warnings: ['over_budget'],
    },
  })
  expect(
    await screen.findByText('These dates exceed your vacation-day allowance.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('No same-length option uses fewer vacation days nearby.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('No longer option uses the same or fewer vacation days nearby.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Your dates' })).toHaveTextContent(
    '-3 vacation days remaining',
  )
})
