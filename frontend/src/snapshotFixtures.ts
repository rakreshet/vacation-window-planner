import type { CalculationContext, WindowAssessment } from './api'
export const window = {
  start_date: '2027-01-07',
  end_date: '2027-01-09',
  total_days: 3,
  vacation_days_used: 0,
  holiday_dates: [],
}
export const assessment: WindowAssessment = {
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
export const context: CalculationContext = {
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
