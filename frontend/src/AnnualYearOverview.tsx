import type { AnnualPlan } from './annualContracts'
import type { AnnualResult } from './savedAnnualPlans'

export default function AnnualYearOverview({
  result,
  plan,
}: {
  result: AnnualResult
  plan: AnnualPlan
}) {
  const year = result.input.year
  return (
    <section aria-label={`${year} year overview`} className="annual-year-overview">
      <div className="annual-overview-heading">
        <h3>{year} at a glance</h3>
        <span>
          {plan.breaks.length} {plan.breaks.length === 1 ? 'break' : 'breaks'} across your year
        </span>
      </div>
      <ol className="annual-overview-months" aria-label={`Months in ${year}`}>
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const month = String(monthIndex + 1).padStart(2, '0')
          const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
          const first = `${year}-${month}-01`
          const last = `${year}-${month}-${days}`
          const date = new Date(Date.UTC(year, monthIndex, 1))
          const name = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
            date,
          )
          const shortName = new Intl.DateTimeFormat('en', {
            month: 'short',
            timeZone: 'UTC',
          }).format(date)
          const breaks = plan.breaks.filter(
            (item) => item.window.start_date <= last && item.window.end_date >= first,
          )
          return (
            <li
              aria-label={name}
              key={month}
              className={`annual-overview-month ${breaks.length ? 'has-breaks' : ''}`}
            >
              <h4 aria-label={name}>{shortName}</h4>
              {breaks.length ? (
                breaks.map((item) => {
                  const start =
                    item.window.start_date < first ? 1 : Number(item.window.start_date.slice(8))
                  const end =
                    item.window.end_date > last ? days : Number(item.window.end_date.slice(8))
                  const label = `Break ${result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1}`
                  return (
                    <div
                      className={`annual-overview-break ${item.locked ? 'is-locked' : ''}`}
                      key={item.slot_id}
                    >
                      <span className="annual-overview-break-label">{label}</span>
                      <strong>{start === end ? start : `${start}–${end}`}</strong>
                      <div className="annual-overview-track" aria-hidden="true">
                        <span
                          style={{
                            left: `${((start - 1) / days) * 100}%`,
                            width: `${((end - start + 1) / days) * 100}%`,
                          }}
                        />
                      </div>
                      {item.locked && <span className="annual-overview-lock">Locked</span>}
                      <span className="sr-only">
                        {item.window.start_date} through {item.window.end_date}, inclusive.
                      </span>
                    </div>
                  )
                })
              ) : (
                <span className="annual-overview-empty">No breaks</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
