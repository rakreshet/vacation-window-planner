import AnnualExportActions from './AnnualExportActions'
import type { AnnualResult } from './savedAnnualPlans'
import { useId } from 'react'
import AnnualPlanComparison from './AnnualPlanComparison'
import AnnualYearView, { annualDetailsId } from './AnnualYearView'
import AnnualPlanChanges from './AnnualPlanChanges'
import type { AnnualBreak, AnnualConflict, AnnualPlan } from './annualContracts'

export default function AnnualPlanResults({
  result,
  stale = false,
  busy = false,
  previousPlan,
  onLock,
  selectedId,
  onSelect,
  onUseReduced,
  onSave,
}: {
  result: AnnualResult
  stale?: boolean
  busy?: boolean
  previousPlan?: AnnualPlan | null
  onLock?: (item: AnnualBreak) => void
  selectedId?: string
  onSelect?: (id: string) => void
  onSave?: (plan: AnnualPlan) => void
  onUseReduced?: (plan: AnnualPlan) => void
}) {
  const headingId = useId()
  const plan = result.plans.find((item) => item.plan_id === selectedId) ?? result.plans[0]
  return (
    <section aria-labelledby={headingId} className="annual-results">
      <h2 id={headingId} tabIndex={-1}>
        Your annual plans
      </h2>
      {stale && <p role="status">Last calculation — inputs have changed</p>}
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
          {onSelect && (
            <AnnualPlanComparison
              plans={result.plans}
              selected={plan.plan_id}
              onSelect={onSelect}
              disabled={busy}
            />
          )}
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
              {onUseReduced && (
                <button type="button" disabled={stale || busy} onClick={() => onUseReduced(plan)}>
                  Use this reduced mix
                </button>
              )}
            </div>
          )}
          {previousPlan && <AnnualPlanChanges previous={previousPlan} current={plan} />}
          <div className="annual-totals">
            <strong>{plan.accounting.total_leave_used} vacation days used</strong>
            <p>
              {plan.accounting.remaining_days} days remain, including {plan.accounting.reserve_days}{' '}
              protected
            </p>
            <p>{plan.accounting.unallocated_days} days unallocated</p>
            <p>{plan.accounting.total_days_away} days away</p>
          </div>
          {onSave && (
            <button type="button" disabled={stale || busy} onClick={() => onSave(plan)}>
              Save this plan
            </button>
          )}
          <AnnualExportActions
            key={`${plan.plan_id}-${result.calculation_context.calculated_at}`}
            result={result}
            planId={plan.plan_id}
            disabled={stale || busy}
          />
          <AnnualYearView result={result} plan={plan} detailPrefix={headingId} />
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
                {!item.locked && onLock && (
                  <button
                    type="button"
                    disabled={stale || busy}
                    onClick={() => onLock(item)}
                    aria-label={`Lock Break ${result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1} dates`}
                  >
                    Lock dates
                  </button>
                )}
                <details
                  id={annualDetailsId(headingId, plan, item.slot_id)}
                  tabIndex={-1}
                  aria-label={`Break ${result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1} charged dates and day details`}
                >
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
