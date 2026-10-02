import { localCalendarDate } from './calendarDays'
import { ExampleTicket, Icon } from './InterfaceArtwork'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { createSession, interpretText, searchRecommendations } from './api'
import type { RecommendationResponse, SessionInput } from './api'
import PlanningFields from './PlanningFields'
import { planningSession, changePlanningCountry } from './planning'
import type { PlanningDraft } from './planning'

type SearchFormProps = {
  onResults: (result: RecommendationResponse, token: string, context: SessionInput) => void
  planning: PlanningDraft
  onPlanningChange: (value: PlanningDraft) => void
  onDraftChange?: () => void
}

type BusyAction = 'interpret' | 'search' | null

export default function SearchForm({
  onResults,
  planning,
  onPlanningChange,
  onDraftChange,
}: SearchFormProps) {
  const [sourceText, setSourceText] = useState('')
  const { balance, allowedNegative, country } = planning
  const [month, setMonth] = useState('')
  const [preferredLength, setPreferredLength] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interpretError, setInterpretError] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const errorSummary = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (error) errorSummary.current?.focus()
  }, [error])
  const revision = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    revision.current += 1
  }, [planning, month, preferredLength, sourceText])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function interpret() {
    setError(null)
    setMessage(null)
    if (!sourceText.trim()) {
      setInterpretError('Describe the break you have in mind, then try Interpret again.')
      return
    }
    setBusy('interpret')
    setInterpretError(null)
    const requestRevision = revision.current
    try {
      const proposal = await interpretText(sourceText, planning.timeZone)
      if (!alive.current || requestRevision !== revision.current) return
      const minimumMonth = localCalendarDate(planning.timeZone).slice(0, 7)
      if (
        proposal.months.some(
          ({ year, month }) => `${year}-${String(month).padStart(2, '0')}` < minimumMonth,
        )
      ) {
        setInterpretError(
          'The assistant suggested a month in the past. Choose this month or a future month, or try your description again.',
        )
        return
      }
      const next = changePlanningCountry(planning, proposal.country_code ?? planning.country)
      onPlanningChange({
        ...next,
        balance: proposal.balance_days !== null ? String(proposal.balance_days) : planning.balance,
        allowedNegative: String(proposal.allowed_negative_days),
        weekendDays: next.pendingCountry
          ? planning.weekendDays
          : (proposal.weekend_days ?? next.weekendDays),
      })
      if (proposal.months.length > 0) {
        const selected = proposal.months[0]
        setMonth(`${selected.year}-${String(selected.month).padStart(2, '0')}`)
      }
      if (proposal.preferred_length_days !== null) {
        setPreferredLength(String(proposal.preferred_length_days))
      }
      setMessage('Proposal ready to edit')
    } catch {
      if (!alive.current || requestRevision !== revision.current) return
      setInterpretError(
        'We could not interpret your description right now. Enter your planning details and select Find my dates, or try the assistant again later.',
      )
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInterpretError(null)
    setMessage(null)
    const balanceDays = Number(balance)
    const lengthDays = Number(preferredLength)
    const negativeDays = Number(allowedNegative)
    if (!balance || !month || !preferredLength || !country) {
      setError('Complete all required search fields')
      return
    }
    if (!Number.isInteger(negativeDays) || negativeDays < 0 || negativeDays > 5) {
      setError('Allowed negative days must be a whole number from 0 to 5')
      return
    }
    if (!Number.isInteger(balanceDays) || balanceDays < 0 || !Number.isInteger(lengthDays)) {
      setError('Balance and preferred length must be positive whole days')
      return
    }
    if (month < localCalendarDate(planning.timeZone).slice(0, 7)) {
      setError('That month is in the past. Choose this month or a future month.')
      return
    }
    const [year, selectedMonth] = month.split('-').map(Number)
    onDraftChange?.()
    setBusy('search')
    const requestRevision = revision.current
    try {
      const context = planningSession(planning)
      const token = await createSession(context)
      const result = await searchRecommendations(token, {
        months: [{ year, month: selectedMonth }],
        preferred_length_days: lengthDays,
        result_limit: 5,
        include_opportunities: true,
        include_action_details: true,
        source_text: sourceText.trim() || null,
      })
      if (!alive.current || requestRevision !== revision.current) return
      onResults(result, token, context)
      setMessage('Search complete')
    } catch (caught) {
      if (!alive.current || requestRevision !== revision.current) return
      setError(caught instanceof Error ? caught.message : 'Search failed')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  return (
    <section className="search-workspace" aria-labelledby="search-heading">
      <div className="search-main planner-card">
        <form className="details-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="panel-title details-title">
            <span className="section-icon">
              <Icon name="calendar" />
            </span>
            <div>
              <h2 id="search-heading">Build your search</h2>
              <p>A few details. A better use of your days off.</p>
            </div>
          </div>

          <div className="field-grid search-fields">
            <PlanningFields value={planning} onChange={onPlanningChange}>
              <div className="field planning-month">
                <label htmlFor="month">
                  Month to explore <span>Required</span>
                </label>
                <input
                  id="month"
                  aria-label="Selected month"
                  type="month"
                  min={localCalendarDate(planning.timeZone).slice(0, 7)}
                  aria-invalid={
                    Boolean(month && month < localCalendarDate(planning.timeZone).slice(0, 7)) ||
                    undefined
                  }
                  value={month}
                  onChange={(event) => {
                    setMonth(event.target.value)
                    onDraftChange?.()
                  }}
                />
                <small>Windows may finish in the next month</small>
              </div>

              <div className="field planning-length">
                <label htmlFor="preferred-length">
                  Ideal break length <span>Required</span>
                </label>
                <div className="input-with-suffix">
                  <input
                    id="preferred-length"
                    aria-label="Preferred length in days"
                    type="number"
                    min="1"
                    step="1"
                    value={preferredLength}
                    placeholder="7"
                    onChange={(event) => {
                      setPreferredLength(event.target.value)
                      onDraftChange?.()
                    }}
                  />
                  <span>days</span>
                </div>
                <div className="length-presets" aria-label="Quick break lengths">
                  {[
                    { days: '3', label: 'Long weekend' },
                    { days: '7', label: 'A week' },
                    { days: '14', label: 'Two weeks' },
                  ].map(({ days, label }) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={preferredLength === days}
                      onClick={() => {
                        setPreferredLength(days)
                        onDraftChange?.()
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </PlanningFields>
          </div>

          {(error || message) && (
            <div className={`form-notice ${error ? 'form-notice--error' : 'form-notice--success'}`}>
              {error ? <AlertIcon /> : <CheckCircleIcon />}
              <p
                ref={errorSummary}
                tabIndex={error ? -1 : undefined}
                role={error ? 'alert' : 'status'}
              >
                {error ?? message}
              </p>
            </div>
          )}

          <div className="search-action">
            <div>
              <strong>Your next break starts here.</strong>
              <span>Up to five options, with every leave day accounted for.</span>
            </div>
            <button
              className="button button--primary"
              type="submit"
              aria-label="Find my dates"
              disabled={
                busy !== null || Boolean(planning.calendarEditor || planning.pendingCountry)
              }
            >
              {busy === 'search' ? 'Finding windows…' : 'Find my dates'}
              <ArrowIcon />
            </button>
          </div>
        </form>
      </div>
      <aside className="search-aside" aria-label="Planning inspiration">
        <section className="prompt-panel" aria-labelledby="description-heading">
          <div className="panel-title">
            <span className="section-icon">
              <Icon name="spark" />
            </span>
            <div>
              <h3 id="description-heading">Start with a little daydream</h3>
              <p>Optional AI assistant</p>
            </div>
          </div>
          <label className="sr-only" htmlFor="source-text">
            Describe your ideal break
          </label>
          <textarea
            id="source-text"
            value={sourceText}
            placeholder="For example: I have 8 leave days and want about a week away in January…"
            onChange={(event) => setSourceText(event.target.value)}
          />
          <div className="prompt-actions">
            <p>
              <ShieldIcon /> AI only fills your planning details. Review them, then search.
            </p>
            <button
              className="button button--secondary"
              type="button"
              aria-label="Fill in my details"
              onClick={() => void interpret()}
              disabled={busy !== null}
            >
              <SparkleIcon />
              {busy === 'interpret' ? 'Interpreting…' : 'Fill in my details'}
            </button>
          </div>
          {interpretError && (
            <div className="form-notice form-notice--error prompt-notice">
              <AlertIcon />
              <p role="alert">{interpretError}</p>
            </div>
          )}
        </section>
        <ExampleTicket />
        <p className="aside-footnote">
          <Icon name="shield" /> No bookings. No commitments.
          <br />
          Just better possibilities.
        </p>
      </aside>
    </section>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5c.7 4 2.4 5.7 6.5 6.5-4.1.8-5.8 2.5-6.5 6.5C9.2 11.5 7.5 9.8 3.5 9 7.5 8.2 9.2 6.5 10 2.5Z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5 16 5v4.7c0 3.5-2.4 6.5-6 7.8-3.6-1.3-6-4.3-6-7.8V5l6-2.5Z" />
      <path d="m7.2 10 1.8 1.8 3.8-4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12M12 6l4 4-4 4" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6.5v4.5M10 14h.01" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.5 10 2.2 2.2 4.8-5" />
    </svg>
  )
}
