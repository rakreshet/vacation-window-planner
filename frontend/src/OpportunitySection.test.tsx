import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import OpportunitySection from './OpportunitySection'

const window = {
  start_date: '2027-02-01',
  end_date: '2027-02-09',
  total_days: 9,
  vacation_days_used: 3,
  holiday_dates: [],
}
afterEach(cleanup)

test('opportunities have independent scores and compare their exact dates', () => {
  const compare = vi.fn()
  render(
    <OpportunitySection
      result={{
        status: 'complete',
        items: [
          {
            opportunity_id: 'opportunity',
            window,
            score: 64,
            raw_points: 64.285714,
            explanation: '9 days off using 3 vacation days. Starts outside your selected months.',
            criteria_differences: [
              { code: 'start_month_outside_selection', actual_month: { year: 2027, month: 2 } },
            ],
            score_breakdown: {
              efficiency: { points: 30, max_points: 50 },
              length: { points: 22.5, max_points: 35 },
              low_leave_use: { points: 11.785714, max_points: 15 },
            },
            assessment: {
              window,
              charged_dates: [],
              day_details: [],
              eligible: true,
              eligibility_reasons: [],
              warnings: [],
              remaining_balance: 5,
            },
          },
        ],
      }}
      onCompare={compare}
      stale={false}
    />,
  )
  expect(screen.getByText(/scored separately from your Search results/i)).toBeInTheDocument()
  expect(screen.getByText(/outside your selected months/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Compare opportunity/ }))
  expect(compare).toHaveBeenCalledWith(window)
})

test.each([
  ['complete', 'No additional opportunities matched your calendar rules.'],
  ['too_broad', 'Opportunity discovery reached its limit. Your Search results are complete.'],
  ['unavailable', 'Opportunities are unavailable right now. Your Search results are complete.'],
] as const)('explains the %s status without replacing Search results', (status, message) => {
  render(<OpportunitySection result={{ status, items: [] }} onCompare={() => {}} stale={false} />)
  expect(screen.getByText(message)).toBeInTheDocument()
})

test('stale opportunities are hidden until another Search', () => {
  render(
    <OpportunitySection result={{ status: 'complete', items: [] }} onCompare={() => {}} stale />,
  )
  expect(screen.queryByRole('heading', { name: 'Other opportunities' })).not.toBeInTheDocument()
})
