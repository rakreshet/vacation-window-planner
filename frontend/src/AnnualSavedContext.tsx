import type { AnnualResult } from './savedAnnualPlans'

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export default function AnnualSavedContext({ result }: { result: AnnualResult }) {
  const planning = result.calculation_context.planning
  return (
    <details>
      <summary>Original request and calendar</summary>
      <p>
        Calendar: {planning.country_code} · {planning.time_zone}
      </p>
      <p>
        Available leave: {planning.balance_days}; reserve: {result.input.reserve_days}; minimum gap:{' '}
        {result.input.minimum_gap_days} dates.
      </p>
      <p>Start months: {result.input.allowed_start_months.join(', ') || 'none'}</p>
      <p>Weekends: {planning.weekend_days.map((day) => weekdayNames[day]).join(', ') || 'none'}</p>
      <p>Minimum notice: {planning.personal_calendar.minimum_notice_days} days</p>
      <ol>
        {result.input.slots.map((slot) => (
          <li key={slot.slot_id}>
            {slot.min_days}–{slot.max_days} days
            {slot.locked_dates
              ? `; locked ${slot.locked_dates.start_date} – ${slot.locked_dates.end_date}`
              : '; generated dates'}
          </li>
        ))}
      </ol>
      <ul>
        {planning.personal_calendar.date_overrides.map((rule, index) => (
          <li key={index}>
            {rule.kind.replaceAll('_', ' ')}: {rule.start_date} – {rule.end_date}
          </li>
        ))}
        {planning.personal_calendar.unavailable_ranges.map((range, index) => (
          <li key={index}>
            Unavailable: {range.start_date} – {range.end_date}
          </li>
        ))}
      </ul>
    </details>
  )
}
