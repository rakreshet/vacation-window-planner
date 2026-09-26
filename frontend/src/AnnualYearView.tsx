import type { AnnualPlan, AnnualRun } from './annualContracts'

export function annualDetailsId(plan: AnnualPlan, slotId: string): string {
  return `annual-details-${plan.plan_id}-${slotId}`
}
export default function AnnualYearView({ result, plan }: { result: AnnualRun; plan: AnnualPlan }) {
  function showDetails(slotId: string) {
    const element = document.getElementById(annualDetailsId(plan, slotId))
    if (element instanceof HTMLDetailsElement) element.open = true
    element?.focus()
    element?.scrollIntoView?.({ block: 'center', behavior: 'auto' })
  }
  return (
    <section aria-label={`${result.input.year} year view`} className="annual-year">
      <h3>{result.input.year} year view</h3>
      <p className="annual-legend">
        Proposed break · 🔒 Locked dates · ● Charged workday · × Unavailable · Past dates faded
      </p>
      <div className="annual-month-grid">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const month = String(monthIndex + 1).padStart(2, '0')
          const days = result.year_calendar.filter((day) => day.date.slice(5, 7) === month)
          const name = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
            new Date(Date.UTC(result.input.year, monthIndex, 1)),
          )
          return (
            <div className="annual-month" key={month}>
              <h4>{name}</h4>
              <p className="sr-only">
                {name}:{' '}
                {plan.breaks
                  .filter(
                    (item) =>
                      item.window.start_date <= `${result.input.year}-${month}-31` &&
                      item.window.end_date >= `${result.input.year}-${month}-01`,
                  )
                  .map(
                    (item) =>
                      `${item.window.start_date} – ${item.window.end_date}${item.locked ? ' (locked)' : ''}`,
                  )
                  .join(', ') || 'no planned breaks'}
                ; unavailable dates:{' '}
                {days
                  .filter((day) => day.unavailable)
                  .map((day) => day.date)
                  .join(', ') || 'none'}
                ; past dates:{' '}
                {days
                  .filter((day) => day.date < result.calculation_context.local_today)
                  .map((day) => day.date)
                  .join(', ') || 'none'}
                .
              </p>
              <div className="annual-days" aria-hidden="true">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((weekday, index) => (
                  <b key={index}>{weekday}</b>
                ))}
                {days.map((day, index) => {
                  const trip = plan.breaks.find(
                    (item) =>
                      day.date >= item.window.start_date && day.date <= item.window.end_date,
                  )
                  const weekday = (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7
                  const className = [
                    'annual-day',
                    trip ? 'annual-day--selected' : '',
                    trip?.locked ? 'annual-day--locked' : '',
                    day.unavailable ? 'annual-day--unavailable' : '',
                    day.date < result.calculation_context.local_today ? 'annual-day--past' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <span
                      key={day.date}
                      className={className}
                      style={index === 0 ? { gridColumnStart: weekday + 1 } : undefined}
                      title={`${day.date}: ${day.kind.replaceAll('_', ' ')}${trip?.locked ? ', locked' : ''}${trip && day.charged ? ', charged' : ''}${day.unavailable ? ', unavailable' : ''}`}
                    >
                      {Number(day.date.slice(8))}
                      <small>
                        {day.unavailable
                          ? '×'
                          : trip && day.charged
                            ? '●'
                            : trip?.locked
                              ? '⌑'
                              : '\u00a0'}
                      </small>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="annual-break-links">
        {plan.breaks.map((item) => {
          const label = `Break ${result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1}`
          return (
            <button
              key={item.slot_id}
              type="button"
              aria-label={`Show ${label} details`}
              onClick={() => showDetails(item.slot_id)}
            >
              {label}: {item.window.start_date} – {item.window.end_date}
              {item.locked ? ' (locked)' : ''}
            </button>
          )
        })}
      </div>
    </section>
  )
}
