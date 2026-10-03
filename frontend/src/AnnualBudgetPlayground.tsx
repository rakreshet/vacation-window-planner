import { annualConflictMessage } from './annualConflictMessage'
import { useEffect, useId, useRef, useState } from 'react'
import { createSession } from './api'
import type { AnnualRun } from './annualContracts'
import { compareAnnualBudgets, type BudgetComparison } from './budgetApi'

export default function AnnualBudgetPlayground({
  result,
  disabled = false,
  onAdopt,
}: {
  result: AnnualRun
  disabled?: boolean
  onAdopt: (budget: number) => void
}) {
  const headingId = useId()
  const [comparison, setComparison] = useState<BudgetComparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  async function compare() {
    if (disabled || active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    try {
      const token = await createSession(result.calculation_context.planning)
      if (controller.signal.aborted) return
      const next = await compareAnnualBudgets(
        token,
        result.input,
        result.calculation_context.planning,
        controller.signal,
      )
      if (!controller.signal.aborted) setComparison(next)
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(
        caught instanceof Error ? caught.message : 'Budget comparison is unavailable. Try again.',
      )
    } finally {
      if (active.current === controller) {
        active.current = null
        if (!controller.signal.aborted) setBusy(false)
      }
    }
  }
  const baseline = comparison?.scenarios.find(
    (scenario) => scenario.available_days === comparison.baseline_days,
  )
  return (
    <section className="budget-playground" aria-labelledby={headingId}>
      <p className="section-kicker">A little leave can go a long way</p>
      <h2 id={headingId}>What could one leave day change?</h2>
      <p>
        Compare Most days away with one fewer or one more available leave day. Your breaks,
        calendar, reserve and locked dates stay fixed.
      </p>
      <button type="button" disabled={disabled || busy} onClick={() => void compare()}>
        {busy ? 'Comparing budgets…' : 'Compare leave budgets'}
      </button>
      {error && <p role="alert">{error}</p>}
      {comparison && (
        <p className="budget-context">
          Hypothetical Most days away plans · calculated{' '}
          {comparison.calculation_context.local_today}. Use a budget to edit your draft, then
          Generate plans.
        </p>
      )}
      {comparison && (
        <section aria-label="Leave budget comparison" className="budget-scenarios">
          {comparison.baseline_days === 366 && (
            <p className="budget-edge">A higher budget is unavailable: 366 days is the maximum.</p>
          )}
          {comparison.baseline_days === comparison.input.reserve_days && (
            <p className="budget-edge">
              A lower budget is unavailable: your protected reserve stays fixed.
            </p>
          )}
          {comparison.scenarios.map((scenario) => (
            <article
              className="budget-scenario"
              aria-label={`${scenario.available_days} leave day scenario`}
              data-baseline={scenario.available_days === comparison.baseline_days}
              key={scenario.available_days}
            >
              <p>
                {scenario.available_days === comparison.baseline_days
                  ? 'Current budget'
                  : 'Hypothetical budget'}
              </p>
              <h3>{scenario.available_days} available leave days</h3>
              {scenario.outcome.status === 'too_broad' && (
                <>
                  <strong>Comparison unfinished</strong>
                  <p>
                    This budget is still unknown because the calculation limit was reached. Try a
                    narrower request.
                  </p>
                </>
              )}
              {scenario.outcome.status === 'infeasible' && (
                <>
                  <strong>Full mix cannot fit</strong>
                  {scenario.outcome.plans[0] && (
                    <>
                      <p>
                        Reduced mix: {scenario.outcome.plans[0].breaks.length} of{' '}
                        {comparison.input.slots.length} breaks
                      </p>
                      <p>
                        Omitted:{' '}
                        {scenario.outcome.plans[0].omitted_slot_ids
                          .map(
                            (id) =>
                              `Break ${comparison.input.slots.findIndex((slot) => slot.slot_id === id) + 1}`,
                          )
                          .join(', ')}
                      </p>
                    </>
                  )}
                </>
              )}
              {scenario.outcome.conflicts.length > 0 && (
                <ul>
                  {scenario.outcome.conflicts.map((conflict, index) => (
                    <li key={index}>{annualConflictMessage(conflict)}</li>
                  ))}
                </ul>
              )}
              {scenario.outcome.plans[0] && (
                <>
                  <strong>{scenario.outcome.plans[0].accounting.total_days_away} days away</strong>
                  <p>
                    {scenario.outcome.plans[0].accounting.total_leave_used} leave days used ·{' '}
                    {scenario.outcome.plans[0].breaks.length}{' '}
                    {scenario.outcome.plans[0].breaks.length === 1 ? 'break' : 'breaks'}
                  </p>
                </>
              )}
              {scenario.available_days !== comparison.baseline_days &&
                scenario.outcome.status === 'complete' &&
                baseline?.outcome.status === 'complete' && (
                  <p className="budget-delta">
                    {scenario.outcome.plans[0].accounting.total_days_away ===
                    baseline.outcome.plans[0].accounting.total_days_away
                      ? 'No additional days away'
                      : `${Math.abs(scenario.outcome.plans[0].accounting.total_days_away - baseline.outcome.plans[0].accounting.total_days_away)} ${scenario.outcome.plans[0].accounting.total_days_away > baseline.outcome.plans[0].accounting.total_days_away ? 'more' : 'fewer'} ${Math.abs(scenario.outcome.plans[0].accounting.total_days_away - baseline.outcome.plans[0].accounting.total_days_away) === 1 ? 'day' : 'days'} away`}
                  </p>
                )}
              {scenario.outcome.plans[0] && (
                <ul className="budget-breaks">
                  {scenario.outcome.plans[0].breaks.map((item) => {
                    const previous = baseline?.outcome.plans[0]?.breaks.find(
                      (other) => other.slot_id === item.slot_id,
                    )
                    const changed =
                      previous &&
                      (previous.window.start_date !== item.window.start_date ||
                        previous.window.end_date !== item.window.end_date)
                    const number =
                      comparison.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1
                    return (
                      <li key={item.slot_id}>
                        <small>
                          Break {number}
                          {item.locked ? ': locked dates' : changed ? ': dates changed' : ''}
                        </small>
                        <span>
                          {item.window.start_date} – {item.window.end_date}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {scenario.outcome.status === 'complete' && (
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onAdopt(scenario.available_days)}
                >
                  Use this budget
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </section>
  )
}
