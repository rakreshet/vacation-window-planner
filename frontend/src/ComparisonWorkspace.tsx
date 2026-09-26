import DateRangeFields from './DateRangeFields'
import { useCallback, useEffect, useRef, useState } from 'react'
import { compareDates, ComparisonError, createSession } from './api'
import type { ComparisonResponse, DateRange, SessionInput } from './api'
import PlanningFields from './PlanningFields'
import ComparisonResults from './ComparisonResults'
import { planningSession, planningFromSession } from './planning'
import type { PlanningDraft } from './planning'

export type ComparisonDraft = { dates: DateRange; planning: PlanningDraft }
export type ComparisonOrigin = { token: string; searchId: string; context: SessionInput }

export default function ComparisonWorkspace({
  draft,
  onDraftChange,
  origin,
  onClose,
  idPrefix = 'compare-',
}: {
  draft: ComparisonDraft
  onDraftChange: (value: ComparisonDraft) => void
  origin?: ComparisonOrigin
  idPrefix?: string
  onClose: () => void
}) {
  const [result, setResult] = useState<ComparisonResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [calculated, setCalculated] = useState<ComparisonDraft | null>(null)
  const [contextOpen, setContextOpen] = useState(!origin)
  const originalDates = useRef<DateRange | null>(
    draft.dates.start_date && draft.dates.end_date ? draft.dates : null,
  )
  const endBeforeStart = Boolean(
    draft.dates.start_date && draft.dates.end_date && draft.dates.end_date < draft.dates.start_date,
  )
  const stale = calculated !== null && JSON.stringify(calculated) !== JSON.stringify(draft)
  const initial = useRef(draft)
  const originUsable = useRef(true)
  const alive = useRef(true)
  const started = useRef(false)

  const run = useCallback(
    async (value: ComparisonDraft) => {
      setBusy(true)
      setError(null)
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
          JSON.stringify(context) ===
            JSON.stringify(planningSession(planningFromSession(origin.context)))
        const token = reuse ? origin.token : await createSession(context)
        const response = await compareDates(token, value.dates, reuse ? origin.searchId : undefined)
        if (alive.current) {
          setResult(response)
          setCalculated(value)
          originalDates.current ??= value.dates
          setContextOpen(false)
        }
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
    const heading = document.getElementById(`${idPrefix}heading`)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ block: 'start' })
    if (origin && !started.current) {
      started.current = true
      void run(initial.current)
    }
    return () => {
      alive.current = false
    }
  }, [origin, run, idPrefix])

  function edit(next: ComparisonDraft) {
    onDraftChange(next)
    setError(null)
  }

  function shift(days: number) {
    const move = (value: string) => {
      const date = new Date(`${value}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + days)
      return date.toISOString().slice(0, 10)
    }
    edit({
      ...draft,
      dates: { start_date: move(draft.dates.start_date), end_date: move(draft.dates.end_date) },
    })
  }

  return (
    <section className="comparison-workspace planner-card" aria-labelledby={`${idPrefix}heading`}>
      <button className="button button--secondary" type="button" onClick={onClose}>
        ← Back to my results
      </button>
      <header className="planner-heading">
        <div>
          <p className="section-kicker">A little flexibility, more possibility</p>
          <h1 id={`${idPrefix}heading`} tabIndex={-1}>
            Could nearby dates work better?
          </h1>
        </div>
        <p>
          Compare the dates you have in mind. Keep the length, save leave—or stretch your break.
        </p>
      </header>
      <form
        className="comparison-editor"
        onSubmit={(event) => {
          event.preventDefault()
          void run(draft)
        }}
      >
        <fieldset disabled={busy} className="comparison-fields">
          <DateRangeFields
            value={draft.dates}
            onChange={(dates) => edit({ ...draft, dates })}
            required
          />
          <div className="date-shifts">
            <span>Move the whole break · same length</span>
            <button
              className="button button--secondary"
              type="button"
              disabled={!draft.dates.start_date || !draft.dates.end_date || endBeforeStart}
              onClick={() => shift(-1)}
            >
              Move 1 day earlier
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!draft.dates.start_date || !draft.dates.end_date || endBeforeStart}
              onClick={() => shift(1)}
            >
              Move 1 day later
            </button>
            {originalDates.current && (
              <button
                className="button button--plain"
                type="button"
                onClick={() => edit({ ...draft, dates: originalDates.current! })}
              >
                Reset original dates
              </button>
            )}
          </div>
          <p className="date-hint">
            Both dates are included. Edit either endpoint to change the length.
          </p>
          <details
            className="comparison-context"
            open={contextOpen}
            onToggle={(event) => setContextOpen(event.currentTarget.open)}
          >
            <summary>
              Calendar and balance · {draft.planning.balance || 'Set your'} vacation days
            </summary>
            <div className="field-grid">
              <PlanningFields
                prefix={idPrefix}
                value={draft.planning}
                onChange={(planning) => edit({ ...draft, planning })}
              />
            </div>
          </details>
        </fieldset>
        <button
          className="button button--primary"
          type="submit"
          disabled={
            busy ||
            endBeforeStart ||
            Boolean(draft.planning.calendarEditor || draft.planning.pendingCountry)
          }
        >
          {busy ? 'Comparing dates…' : result ? 'Update comparison' : 'Compare dates'}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-notice form-notice--error">
          {error}
        </p>
      )}
      <p className="comparison-status" role="status">
        {busy
          ? 'Calculating your dates and nearby options…'
          : error
            ? ''
            : stale
              ? 'Inputs changed · update to recalculate.'
              : result
                ? 'Comparison ready. Your dates are the reference for every option below.'
                : ''}
      </p>
      {result && (
        <ComparisonResults
          key={result.comparison_id}
          result={result}
          stale={stale || busy || Boolean(error)}
        />
      )}
    </section>
  )
}
