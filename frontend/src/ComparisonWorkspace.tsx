import { useCallback, useEffect, useRef, useState } from 'react'
import { compareDates, ComparisonError, createSession } from './api'
import type { ComparisonResponse, DateRange, SessionInput } from './api'
import PlanningFields from './PlanningFields'
import { planningSession } from './planning'
import type { PlanningDraft } from './planning'

export type ComparisonDraft = { dates: DateRange; planning: PlanningDraft }
export type ComparisonOrigin = { token: string; searchId: string; context: SessionInput }

export default function ComparisonWorkspace({
  draft,
  onDraftChange,
  origin,
  onClose,
}: {
  draft: ComparisonDraft
  onDraftChange: (value: ComparisonDraft) => void
  origin?: ComparisonOrigin
  onClose: () => void
}) {
  const [result, setResult] = useState<ComparisonResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const initial = useRef(draft)
  const originUsable = useRef(true)
  const alive = useRef(true)
  const started = useRef(false)

  const run = useCallback(
    async (value: ComparisonDraft) => {
      setBusy(true)
      setError(null)
      setResult(null)
      try {
        if (
          !value.dates.start_date ||
          !value.dates.end_date ||
          value.dates.end_date < value.dates.start_date
        ) {
          throw new Error('Choose a start date and an end date on or after it')
        }
        const context = planningSession(value.planning)
        const reuse =
          originUsable.current &&
          origin &&
          JSON.stringify(context) === JSON.stringify(origin.context)
        const token = reuse ? origin.token : await createSession(context)
        const response = await compareDates(token, value.dates, reuse ? origin.searchId : undefined)
        if (alive.current) setResult(response)
      } catch (caught) {
        if (!alive.current) return
        if (
          caught instanceof ComparisonError &&
          (caught.code === 'SESSION_EXPIRED' || caught.code === 'INVALID_SESSION')
        ) {
          originUsable.current = false
          setError('Your session expired. Compare again to continue with these dates.')
        } else setError(caught instanceof Error ? caught.message : 'Comparison failed. Try again.')
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [origin],
  )

  useEffect(() => {
    alive.current = true
    const heading = document.getElementById('comparison-heading')
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ block: 'start' })
    if (origin && !started.current) {
      started.current = true
      void run(initial.current)
    }
    return () => {
      alive.current = false
    }
  }, [origin, run])

  function edit(next: ComparisonDraft) {
    onDraftChange(next)
    setResult(null)
    setError(null)
  }

  return (
    <section className="comparison-workspace planner-card" aria-labelledby="comparison-heading">
      <button className="button button--secondary" type="button" onClick={onClose}>
        ← Back to my results
      </button>
      <header className="planner-heading">
        <div>
          <p className="section-kicker">A little flexibility, more possibility</p>
          <h2 id="comparison-heading" tabIndex={-1}>
            Could nearby dates work better?
          </h2>
        </div>
        <p>
          Compare the dates you have in mind. Keep the length, save leave—or stretch your break.
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(draft)
        }}
      >
        <fieldset disabled={busy} className="comparison-fields">
          <div className="field-grid">
            <div className="field">
              <label htmlFor="compare-start">Start date</label>
              <input
                id="compare-start"
                type="date"
                required
                value={draft.dates.start_date}
                onChange={(e) =>
                  edit({ ...draft, dates: { ...draft.dates, start_date: e.target.value } })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="compare-end">End date</label>
              <input
                id="compare-end"
                type="date"
                required
                value={draft.dates.end_date}
                onChange={(e) =>
                  edit({ ...draft, dates: { ...draft.dates, end_date: e.target.value } })
                }
              />
            </div>
            <PlanningFields
              prefix="compare-"
              value={draft.planning}
              onChange={(planning) => edit({ ...draft, planning })}
            />
          </div>
        </fieldset>
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? 'Comparing dates…' : 'Compare dates'}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-notice form-notice--error">
          {error}
        </p>
      )}
      {result && (
        <div className="comparison-baseline" aria-label="Your dates">
          <p className="section-kicker">Your dates</p>
          <h3>
            {result.baseline.window.start_date} – {result.baseline.window.end_date}
          </h3>
          <p>{result.baseline.window.total_days} total days off</p>
          <p>{result.baseline.window.vacation_days_used} vacation days used</p>
          <p>{result.baseline.remaining_balance} vacation days remaining</p>
          {!result.baseline.feasible && (
            <p className="form-notice form-notice--error">
              These dates exceed your vacation-day allowance.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
