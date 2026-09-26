import type { AnnualConflict, AnnualRun } from './annualContracts'

export default function AnnualPlanResults({ result }: { result: AnnualRun }) {
  const plan = result.plans[0]
  return (
    <section aria-labelledby="annual-results-heading" className="annual-results">
      <h2 id="annual-results-heading" tabIndex={-1}>
        Your annual plans
      </h2>
      {result.status === 'too_broad' && (
        <p role="status">
          We could not finish checking this request. Try fewer breaks, narrower lengths or fewer
          start months. Your reserve and locks have been kept.
        </p>
      )}
      {result.status === 'conflict' && (
        <p role="status">
          Your locked trips conflict. Edit the dates, calendar, gap or budget and calculate again.
        </p>
      )}
      {result.status === 'infeasible' && (
        <p>
          The full requested mix cannot fit. Any plan below omits whole unlocked breaks; your
          reserve remains protected.
        </p>
      )}
      {result.conflicts.length > 0 && (
        <ul>
          {result.conflicts.map((conflict, index) => (
            <li key={index}>
              {conflictMessage(conflict)} Affected:{' '}
              {conflict.slot_ids
                .map(
                  (id) =>
                    `Break ${result.input.slots.findIndex((slot) => slot.slot_id === id) + 1}`,
                )
                .join(', ')}
              .
            </li>
          ))}
        </ul>
      )}
      {plan && (
        <>
          {plan.fulfillment === 'reduced' && (
            <div role="status">
              <strong>
                Reduced plan: {plan.breaks.length} of {result.input.slots.length} requested breaks
              </strong>
              <p>
                Omitted:{' '}
                {plan.omitted_slot_ids
                  .map(
                    (id) =>
                      `Break ${result.input.slots.findIndex((slot) => slot.slot_id === id) + 1}`,
                  )
                  .join(', ')}
              </p>
            </div>
          )}
          <div className="annual-totals">
            <strong>{plan.accounting.total_leave_used} vacation days used</strong>
            <p>
              {plan.accounting.remaining_days} days remain, including {plan.accounting.reserve_days}{' '}
              protected
            </p>
            <p>{plan.accounting.unallocated_days} days unallocated</p>
            <p>{plan.accounting.total_days_away} days away</p>
          </div>
          <ol>
            {plan.breaks.map((item) => (
              <li key={item.slot_id}>
                {item.locked && (
                  <p>
                    Locked dates
                    {item.notice_waived ? '; minimum notice waived for this arranged trip' : ''}
                  </p>
                )}
                <h3>
                  {item.window.start_date} – {item.window.end_date}
                </h3>
                <p>
                  {item.window.total_days} days away · {item.window.vacation_days_used} vacation
                  days · {item.balance_after_break} remain
                </p>
                <details>
                  <summary>Charged dates and day details</summary>
                  <p>Charged dates: {item.charged_dates.join(', ') || 'None'}</p>
                  <ul>
                    {item.day_details.map((day) => (
                      <li key={day.date}>
                        {day.date}: {day.kind.replaceAll('_', ' ')}
                        {day.charged ? ', charged' : ', no leave charged'}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function conflictMessage(conflict: AnnualConflict): string {
  switch (conflict.code) {
    case 'locked_budget':
      return `Locked trips use ${conflict.required_days} days; only ${conflict.permitted_days} are available after reserve.`
    case 'mix_budget':
      return `The full mix needs at least ${conflict.required_days} leave days; ${conflict.permitted_days} are available after reserve.`
    case 'locked_overlap':
      return 'Locked dates overlap. Edit or remove one of the affected breaks.'
    case 'locked_unavailable':
      return `Locked dates intersect unavailable dates: ${conflict.dates.join(', ')}.`
    case 'locked_spacing':
      return `Locked trips have ${conflict.gap_days} intervening dates and ${conflict.working_dates_between} working dates; they need at least ${conflict.minimum_gap_days} intervening dates and one working date.`
    case 'mix_constraints':
      return 'The full mix cannot fit these combined calendar, length and spacing constraints.'
  }
}
