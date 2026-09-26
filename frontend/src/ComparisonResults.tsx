import { useEffect, useRef, useState } from 'react'
import type { ComparedWindow, ComparisonAlternative, ComparisonResponse, DateRange } from './api'

export function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
function range(value: DateRange): string {
  return `${displayDate(value.start_date)} – ${displayDate(value.end_date)}`
}
function outcome(option: ComparisonAlternative): string {
  const { extra_days: extra, vacation_days_saved: saved } = option.delta
  return extra === 0
    ? `Same ${option.evaluation.window.total_days} days off, ${saved} fewer vacation ${saved === 1 ? 'day' : 'days'}`
    : `${extra} more ${extra === 1 ? 'day' : 'days'} off, ${saved ? `${saved} fewer vacation ${saved === 1 ? 'day' : 'days'}` : 'no extra vacation days'}`
}
function movement(days: number): string {
  return days === 0
    ? 'on the same day'
    : `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'earlier' : 'later'}`
}

export function WindowSummary({
  value,
  label,
  children,
  compareTo,
}: {
  value: ComparedWindow
  label: string
  compareTo?: ComparedWindow
  children?: React.ReactNode
}) {
  return (
    <section className="window-summary" aria-label={label}>
      <p className="section-kicker">{label}</p>
      <h2>{range(value.window)}</h2>
      {compareTo ? (
        <table className="comparison-table">
          <caption>How the dates compare</caption>
          <thead>
            <tr>
              <th scope="col">Days</th>
              <th scope="col">Your dates</th>
              <th scope="col">Alternative</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total days off</th>
              <td>{compareTo.window.total_days}</td>
              <td>{value.window.total_days}</td>
            </tr>
            <tr>
              <th scope="row">Vacation days used</th>
              <td>{compareTo.window.vacation_days_used}</td>
              <td>{value.window.vacation_days_used}</td>
            </tr>
            <tr>
              <th scope="row">Balance remaining</th>
              <td>{compareTo.remaining_balance}</td>
              <td>{value.remaining_balance}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="comparison-metrics">
          <p>
            <strong>{value.window.total_days}</strong> total days off
          </p>
          <p>
            <strong>{value.window.vacation_days_used}</strong> vacation days used
          </p>
          <p>
            <strong>{value.remaining_balance}</strong> vacation days remaining
          </p>
        </div>
      )}
      {value.assessment?.eligibility_reasons.map((reason) => (
        <p key={reason.code} className="form-notice form-notice--error">
          {reason.code === 'unavailable_dates'
            ? `Includes unavailable dates: ${reason.dates.map(displayDate).join(', ')}.`
            : reason.code === 'insufficient_notice'
              ? `Minimum notice requires starting on or after ${displayDate(reason.earliest_start_date)}.`
              : 'These dates exceed your vacation-day allowance.'}
        </p>
      ))}
      {!value.assessment && !value.feasible ? (
        <p className="form-notice form-notice--error">
          These dates exceed your vacation-day allowance.
        </p>
      ) : value.remaining_balance < 0 && !value.warnings.includes('over_budget') ? (
        <p className="comparison-warning">
          Uses {Math.abs(value.remaining_balance)} vacation days beyond your balance, within your
          allowed negative balance.
        </p>
      ) : value.warnings.includes('full_balance') ? (
        <p className="comparison-warning">Uses your full vacation balance.</p>
      ) : null}
      {children}
      <details className="day-breakdown" open>
        <summary>Day by day · what uses your balance</summary>
        <ol className="day-strip">
          {Array.from({ length: value.window.total_days }, (_, index) => {
            const day = new Date(`${value.window.start_date}T00:00:00Z`)
            day.setUTCDate(day.getUTCDate() + index)
            const date = day.toISOString().slice(0, 10)
            const holiday = value.window.holiday_dates.includes(date)
            const weekend = value.weekend_dates.includes(date)
            const detail = value.assessment?.day_details.find((item) => item.date === date)
            const charged = detail?.charged ?? value.charged_dates.includes(date)
            const effectiveLabels = {
              extra_working_day: 'Extra working day · Vacation day',
              personal_day_off: 'Personal day off',
              public_holiday: 'Public holiday',
              weekend: 'Weekend',
              ordinary_working: 'Vacation day',
            }
            const label = detail
              ? `${effectiveLabels[detail.kind]}${detail.unavailable ? ' · Unavailable' : ''}`
              : holiday
                ? `Public holiday${weekend ? ' · Weekend' : ''}`
                : weekend
                  ? 'Weekend'
                  : charged
                    ? 'Vacation day'
                    : 'Day off'
            return (
              <li
                key={date}
                className={charged ? 'day-cell day-cell--charged' : 'day-cell'}
                aria-label={`${displayDate(date)}: ${label}`}
              >
                <span>
                  {day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                </span>
                <strong>
                  {day.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </strong>
                <small>{label}</small>
              </li>
            )
          })}
        </ol>
      </details>
    </section>
  )
}

export default function ComparisonResults({
  result,
  stale,
}: {
  result: ComparisonResponse
  stale: boolean
}) {
  const [selected, setSelected] = useState<ComparisonAlternative | null>(null)
  const selectedView = useRef<HTMLDivElement>(null)
  const selectionButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (selected && !stale) {
      selectedView.current?.focus({ preventScroll: true })
      selectedView.current?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [selected, stale])
  return (
    <div className="comparison-layout">
      <div className="comparison-anchor">
        <WindowSummary value={result.baseline} label="Your dates" />
      </div>
      <div className="comparison-options">
        {stale ? (
          <p className="comparison-empty">
            Update comparison to see current suggestions. Your last calculated dates remain here for
            reference.
          </p>
        ) : (
          <>
            {selected && (
              <div
                ref={selectedView}
                tabIndex={-1}
                className="selected-comparison"
                aria-label="Selected comparison details"
              >
                <WindowSummary
                  value={selected.evaluation}
                  label="Selected alternative"
                  compareTo={result.baseline}
                >
                  <p className="comparison-outcome">{outcome(selected)}</p>
                  <p>
                    Starts {movement(selected.delta.start_shift_days)} · Ends{' '}
                    {movement(selected.delta.end_shift_days)}
                  </p>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => {
                      setSelected(null)
                      selectionButton.current?.focus({ preventScroll: true })
                    }}
                  >
                    Keep my dates
                  </button>
                </WindowSummary>
              </div>
            )}
            {(
              [
                {
                  key: 'save_leave',
                  title: 'Same break. Less leave.',
                  empty: 'No same-length option uses fewer vacation days nearby.',
                },
                {
                  key: 'longer_break',
                  title: 'A longer break. No extra leave.',
                  empty: 'No longer option uses the same or fewer vacation days nearby.',
                },
              ] as const
            ).map((group) => (
              <section key={group.key} aria-label={group.title} className="comparison-group">
                <h2>{group.title}</h2>
                {result[group.key].length ? (
                  <ul>
                    {result[group.key].map((option) => (
                      <li
                        key={`${option.evaluation.window.start_date}/${option.evaluation.window.end_date}`}
                      >
                        <button
                          type="button"
                          className="comparison-option"
                          aria-pressed={selected === option}
                          onClick={(event) => {
                            selectionButton.current = event.currentTarget
                            setSelected(option)
                          }}
                        >
                          <strong>{outcome(option)}</strong>
                          <span>{range(option.evaluation.window)}</span>
                          <small>
                            Starts {movement(option.delta.start_shift_days)} · Ends{' '}
                            {movement(option.delta.end_shift_days)}
                          </small>
                          <span className="option-action">
                            {selected === option ? 'Viewing comparison ↑' : 'See the difference →'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="comparison-empty">{group.empty}</p>
                )}
              </section>
            ))}
            <p className="comparison-scope">
              Starts within {result.policy.shift_days} days of your dates, with up to{' '}
              {result.policy.extra_days} extra days off. Suggestions respect the calendar rules
              entered. Other commitments and employer approval have not been checked.
            </p>
            {result.notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
