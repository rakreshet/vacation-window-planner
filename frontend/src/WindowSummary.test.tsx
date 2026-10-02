import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { WindowSummary } from './ComparisonResults'

afterEach(cleanup)

test('a blocked extra working Friday is charged and not called over budget', () => {
  const window = {
    start_date: '2027-01-08',
    end_date: '2027-01-08',
    total_days: 1,
    vacation_days_used: 1,
    holiday_dates: [],
  }
  render(
    <WindowSummary
      label="Your dates"
      value={{
        window,
        charged_dates: ['2027-01-08'],
        weekend_dates: ['2027-01-08'],
        remaining_balance: 7,
        feasible: false,
        warnings: [],
        assessment: {
          window,
          charged_dates: ['2027-01-08'],
          remaining_balance: 7,
          eligible: false,
          warnings: [],
          eligibility_reasons: [{ code: 'unavailable_dates', dates: ['2027-01-08'] }],
          day_details: [
            {
              date: '2027-01-08',
              charged: true,
              kind: 'extra_working_day',
              is_weekend: true,
              is_public_holiday: false,
              unavailable: true,
            },
          ],
        },
      }}
    />,
  )
  expect(screen.getByText(/unavailable dates/i)).toBeInTheDocument()
  expect(screen.queryByText(/exceed your vacation-day allowance/)).not.toBeInTheDocument()
  expect(screen.getByText(/Extra working day/)).toBeInTheDocument()
})
