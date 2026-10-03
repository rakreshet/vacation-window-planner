import { annualRunSchema } from './annualContracts'
import { annualFixture } from './annualFixtures'

export function sixBreakCardFixture(reduced = false) {
  const base = annualFixture()
  const year_calendar = Array.from({ length: 366 }, (_, index) => {
    const day = new Date(Date.UTC(2028, 0, index + 1))
    const is_weekend = [0, 6].includes(day.getUTCDay())
    return {
      date: day.toISOString().slice(0, 10),
      charged: !is_weekend,
      kind: is_weekend ? 'weekend' : 'ordinary_working',
      is_weekend,
      is_public_holiday: false,
      unavailable: false,
    }
  })
  const periods = [
    ['2028-02-26', '2028-03-02'],
    ['2028-04-01', '2028-04-03'],
    ['2028-06-03', '2028-06-05'],
    ['2028-08-05', '2028-08-07'],
    ['2028-10-07', '2028-10-09'],
    ['2028-12-02', '2028-12-04'],
  ]
  const slots = periods.map(([start_date, end_date], index) => ({
    slot_id: `slot-${index + 1}`,
    min_days: 3,
    max_days: 6,
    locked_dates: index === 0 ? { start_date, end_date } : null,
  }))
  let balance = 18
  const breaks = periods.slice(0, reduced ? 4 : 6).map(([start_date, end_date], index) => {
    const day_details = year_calendar.filter(
      (day) => day.date >= start_date && day.date <= end_date,
    )
    const charged_dates = day_details.filter((day) => day.charged).map((day) => day.date)
    balance -= charged_dates.length
    return {
      slot_id: `slot-${index + 1}`,
      locked: index === 0,
      notice_waived: false,
      balance_after_break: balance,
      day_details,
      charged_dates,
      window: {
        start_date,
        end_date,
        total_days: day_details.length,
        vacation_days_used: charged_dates.length,
        holiday_dates: [],
      },
    }
  })
  return annualRunSchema.parse({
    ...base,
    input: { ...base.input, year: 2028, slots },
    year_calendar,
    status: reduced ? 'infeasible' : 'complete',
    full_mix_feasibility: reduced ? 'infeasible' : 'feasible',
    conflicts: reduced
      ? [{ code: 'mix_constraints', slot_ids: slots.map((slot) => slot.slot_id) }]
      : [],
    plans: [
      {
        ...base.plans[0],
        fulfillment: reduced ? 'reduced' : 'full',
        retained_slot_ids: slots.slice(0, reduced ? 4 : 6).map((slot) => slot.slot_id),
        omitted_slot_ids: reduced ? ['slot-5', 'slot-6'] : [],
        breaks,
        accounting: {
          ...base.plans[0].accounting,
          total_leave_used: 18 - balance,
          remaining_days: balance,
          unallocated_days: balance - 3,
          total_days_away: reduced ? 15 : 21,
          charged_dates: breaks.flatMap((item) => item.charged_dates),
        },
      },
    ],
  })
}
