import { useState } from 'react'
import type { FormEvent } from 'react'

import { createSession, interpretText, searchRecommendations } from './api'
import type { RecommendationResponse } from './api'

type SearchFormProps = {
  onResults: (result: RecommendationResponse, token: string) => void
}

type BusyAction = 'interpret' | 'search' | null

const WEEKDAYS = [
  { value: 0, short: 'Mon', label: 'Monday' },
  { value: 1, short: 'Tue', label: 'Tuesday' },
  { value: 2, short: 'Wed', label: 'Wednesday' },
  { value: 3, short: 'Thu', label: 'Thursday' },
  { value: 4, short: 'Fri', label: 'Friday' },
  { value: 5, short: 'Sat', label: 'Saturday' },
  { value: 6, short: 'Sun', label: 'Sunday' },
]

export default function SearchForm({ onResults }: SearchFormProps) {
  const [sourceText, setSourceText] = useState('')
  const [balance, setBalance] = useState('')
  const [allowedNegative, setAllowedNegative] = useState('0')
  const [country, setCountry] = useState('IL')
  const [month, setMonth] = useState('')
  const [preferredLength, setPreferredLength] = useState('')
  const [weekendDays, setWeekendDays] = useState<number[]>([4, 5])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interpretError, setInterpretError] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)

  async function interpret() {
    setError(null)
    setMessage(null)
    if (!sourceText.trim()) {
      setInterpretError('Describe the break you have in mind, then try Interpret again.')
      return
    }
    setBusy('interpret')
    setInterpretError(null)
    try {
      const proposal = await interpretText(sourceText)
      if (proposal.balance_days !== null) setBalance(String(proposal.balance_days))
      setAllowedNegative(String(proposal.allowed_negative_days))
      if (proposal.country_code !== null) setCountry(proposal.country_code)
      if (proposal.months.length > 0) {
        const selected = proposal.months[0]
        setMonth(`${selected.year}-${String(selected.month).padStart(2, '0')}`)
      }
      if (proposal.preferred_length_days !== null) {
        setPreferredLength(String(proposal.preferred_length_days))
      }
      if (proposal.weekend_days !== null) setWeekendDays(proposal.weekend_days)
      setMessage('Proposal ready to edit')
    } catch {
      setInterpretError(
        'We could not interpret your description right now. Enter the details below and click Search, or try Interpret again later.',
      )
    } finally {
      setBusy(null)
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
    const [year, selectedMonth] = month.split('-').map(Number)
    setBusy('search')
    try {
      const token = await createSession({
        balance_days: balanceDays,
        allowed_negative_days: negativeDays,
        country_code: country,
        weekend_days: weekendDays,
      })
      const result = await searchRecommendations(token, {
        months: [{ year, month: selectedMonth }],
        preferred_length_days: lengthDays,
        result_limit: 5,
        source_text: sourceText.trim() || null,
      })
      onResults(result, token)
      setMessage('Search complete')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed')
    } finally {
      setBusy(null)
    }
  }

  function toggleWeekend(day: number) {
    setWeekendDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    )
  }

  return (
    <section className="planner-card" aria-labelledby="search-heading">
      <header className="planner-heading">
        <div>
          <p className="section-kicker">Your planning workspace</p>
          <h2 id="search-heading">Build your search</h2>
        </div>
        <p>
          Start with a sentence or go straight to the details. You stay in control before anything
          is searched.
        </p>
      </header>

      <div className="planner-layout">
        <div className="planner-main">
          <section className="prompt-panel" aria-labelledby="description-heading">
            <div className="panel-title">
              <span className="step-number">1</span>
              <div>
                <h3 id="description-heading">Describe the break you want</h3>
                <p>Optional · AI can turn your sentence into an editable proposal.</p>
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
                <ShieldIcon /> Interpret only fills the editable fields below. It never starts a
                search.
              </p>
              <button
                className="button button--secondary"
                type="button"
                aria-label="Interpret"
                onClick={() => void interpret()}
                disabled={busy !== null}
              >
                <SparkleIcon />
                {busy === 'interpret' ? 'Interpreting…' : 'Interpret request'}
              </button>
            </div>
            {interpretError && (
              <div className="form-notice form-notice--error prompt-notice">
                <AlertIcon />
                <p role="alert">{interpretError}</p>
              </div>
            )}
          </section>

          <div className="choice-divider" aria-hidden="true">
            <span>then review and adjust</span>
          </div>

          <form className="details-form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="panel-title details-title">
              <span className="step-number">2</span>
              <div>
                <h3>Set your planning details</h3>
                <p>These confirmed values—not the description above—drive your search.</p>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="balance">
                  Vacation balance <span>Required</span>
                </label>
                <div className="input-with-suffix">
                  <input
                    id="balance"
                    aria-label="Vacation balance"
                    type="number"
                    min="0"
                    step="1"
                    value={balance}
                    placeholder="8"
                    onChange={(event) => setBalance(event.target.value)}
                  />
                  <span>days</span>
                </div>
                <small>Available before this break</small>
              </div>

              <div className="field">
                <label htmlFor="allowed-negative">Allowed negative days</label>
                <div className="input-with-suffix">
                  <input
                    id="allowed-negative"
                    type="number"
                    min="0"
                    max="5"
                    step="1"
                    value={allowedNegative}
                    onChange={(event) => setAllowedNegative(event.target.value)}
                  />
                  <span>days</span>
                </div>
                <small>How far below zero you will accept</small>
              </div>

              <div className="field">
                <label htmlFor="country">Public holiday calendar</label>
                <div className="select-wrap">
                  <select
                    id="country"
                    aria-label="Country calendar"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  >
                    <option value="IL">Israel</option>
                  </select>
                  <ChevronIcon />
                </div>
                <small>Israel is supported in Phase 0</small>
              </div>

              <div className="field">
                <label htmlFor="month">
                  Month to explore <span>Required</span>
                </label>
                <input
                  id="month"
                  aria-label="Selected month"
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
                <small>Windows may finish in the next month</small>
              </div>

              <div className="field">
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
                    onChange={(event) => setPreferredLength(event.target.value)}
                  />
                  <span>days</span>
                </div>
                <small>Close alternatives may also appear</small>
              </div>

              <fieldset className="field field--wide weekend-field">
                <legend>Weekend days</legend>
                <small>Choose the days that are normally free for you</small>
                <div className="day-picker">
                  {WEEKDAYS.map((day) => (
                    <label key={day.value}>
                      <input
                        type="checkbox"
                        aria-label={day.label}
                        checked={weekendDays.includes(day.value)}
                        onChange={() => toggleWeekend(day.value)}
                      />
                      <span>{day.short}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {(error || message) && (
              <div
                className={`form-notice ${error ? 'form-notice--error' : 'form-notice--success'}`}
              >
                {error ? <AlertIcon /> : <CheckCircleIcon />}
                <p role={error ? 'alert' : 'status'}>{error ?? message}</p>
              </div>
            )}

            <div className="search-action">
              <div>
                <strong>Ready to find your best windows?</strong>
                <span>We rank up to five options and explain every trade-off.</span>
              </div>
              <button
                className="button button--primary"
                type="submit"
                aria-label="Search"
                disabled={busy !== null}
              >
                {busy === 'search' ? 'Finding windows…' : 'Find my best windows'}
                <ArrowIcon />
              </button>
            </div>
          </form>
        </div>

        <aside className="planner-guide" aria-label="How your search works">
          <p className="guide-kicker">How it works</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Tell us your constraints</strong>
                <p>Use plain language or enter them yourself.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Review every field</strong>
                <p>Nothing inferred is locked or searched automatically.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Compare clear trade-offs</strong>
                <p>See time off, leave used, balance impact, and warnings.</p>
              </div>
            </li>
          </ol>
          <div className="privacy-note">
            <ShieldIcon />
            <div>
              <strong>Your plan stays anonymous</strong>
              <p>No account, name, email, or travel booking data is required.</p>
            </div>
          </div>
        </aside>
      </div>
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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6 8 4 4 4-4" />
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
