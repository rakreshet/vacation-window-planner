const chargedDates = [
  '2027-03-07',
  '2027-03-08',
  '2027-05-10',
  '2027-08-08',
  '2027-08-09',
  '2027-08-10',
  '2027-08-11',
  '2027-08-12',
]
const yearCalendar = Array.from({ length: 365 }, (_, index) => {
  const day = new Date(Date.UTC(2027, 0, 1 + index))
  const date = day.toISOString().slice(0, 10)
  const weekend = [5, 6].includes(day.getUTCDay())
  const personal = date === '2027-05-09'
  return {
    date,
    charged: !weekend && !personal,
    kind: personal ? 'personal_day_off' : weekend ? 'weekend' : 'ordinary_working',
    is_public_holiday: false,
    is_weekend: weekend,
    unavailable: false,
  }
})
function selectedBreak(
  slot_id: string,
  start_date: string,
  end_date: string,
  balance_after_break: number,
) {
  const day_details = yearCalendar.filter((day) => day.date >= start_date && day.date <= end_date)
  const charged_dates = chargedDates.filter((day) => day >= start_date && day <= end_date)
  return {
    slot_id,
    locked: false,
    notice_waived: false,
    balance_after_break,
    charged_dates,
    day_details,
    window: {
      start_date,
      end_date,
      total_days: day_details.length,
      vacation_days_used: charged_dates.length,
      holiday_dates: [],
    },
  }
}
export function annualFixture() {
  return {
    run_id: '00000000-0000-4000-8000-000000000001',
    status: 'complete',
    full_mix_feasibility: 'feasible',
    input: {
      year: 2027,
      reserve_days: 3,
      minimum_gap_days: 7,
      allowed_start_months: Array.from({ length: 12 }, (_, i) => i + 1),
      slots: [
        { slot_id: 'long', min_days: 7, max_days: 14, locked_dates: null },
        { slot_id: 'short-1', min_days: 3, max_days: 5, locked_dates: null },
        { slot_id: 'short-2', min_days: 3, max_days: 5, locked_dates: null },
      ],
    },
    calculation_context: {
      accounting_version: 'phase075-v1',
      calculated_at: '2026-09-26T12:00:00Z',
      local_today: '2026-09-26',
      planning: {
        balance_days: 18,
        allowed_negative_days: 0,
        country_code: 'IL',
        weekend_days: [4, 5],
        time_zone: 'Asia/Jerusalem',
        personal_calendar: {
          schema_version: 1,
          minimum_notice_days: 0,
          unavailable_ranges: [],
          date_overrides: [
            { start_date: '2027-05-09', end_date: '2027-05-09', kind: 'personal_day_off' },
          ],
        },
      },
    },
    policy: {
      version: 'annual-v1',
      candidate_limit: 12000,
      state_limit: 500000,
      transition_limit: 5000000,
      time_limit_seconds: 5,
    },
    counters: { candidates: 100, states: 200, transitions: 300 },
    limit_reason: null,
    conflicts: [],
    locked_assessments: [],
    year_calendar: yearCalendar,
    plans: [
      {
        plan_id: 'a'.repeat(64),
        objective: 'most_days_away',
        fulfillment: 'full',
        retained_slot_ids: ['long', 'short-1', 'short-2'],
        omitted_slot_ids: [],
        breaks: [
          selectedBreak('short-1', '2027-03-05', '2027-03-08', 16),
          selectedBreak('short-2', '2027-05-07', '2027-05-10', 15),
          selectedBreak('long', '2027-08-06', '2027-08-14', 10),
        ],
        accounting: {
          available_days: 18,
          reserve_days: 3,
          spendable_days: 15,
          total_leave_used: 8,
          remaining_days: 10,
          unallocated_days: 7,
          total_days_away: 17,
          charged_dates: chargedDates,
        },
      },
    ],
  }
}
