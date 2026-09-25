import { useState } from 'react'

import type { FeedbackValue, Recommendation, RecommendationResponse } from './api'

type RecommendationResultsProps = {
  result: RecommendationResponse
  onFeedback?: (rank: number, value: FeedbackValue) => Promise<void>
}

function dateParts(value: string): { monthDay: string; year: number } {
  const parsed = new Date(`${value}T00:00:00Z`)
  return {
    monthDay: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(parsed),
    year: parsed.getUTCFullYear(),
  }
}

function dateWindow(window: Recommendation['window']): string {
  const start = dateParts(window.start_date)
  const end = dateParts(window.end_date)
  if (start.year === end.year) return `${start.monthDay} – ${end.monthDay}, ${end.year}`
  return `${start.monthDay}, ${start.year} – ${end.monthDay}, ${end.year}`
}

function points(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

function warningText(warning: string, remainingBalance: number): string {
  if (warning === 'full_balance') return 'Uses your full vacation balance'
  if (warning === 'negative_balance') {
    const days = Math.abs(remainingBalance)
    return `Uses ${days} ${days === 1 ? 'day' : 'days'} beyond your current balance`
  }
  if (warning === 'length_relaxed') return 'Length differs from your preferred length'
  return warning
}

export default function RecommendationResults({ result, onFeedback }: RecommendationResultsProps) {
  const [feedbackStatus, setFeedbackStatus] = useState<Record<number, string>>({})
  const [feedbackChoice, setFeedbackChoice] = useState<Record<number, FeedbackValue>>({})

  async function saveFeedback(rank: number, value: FeedbackValue) {
    if (onFeedback === undefined) return
    setFeedbackChoice((current) => ({ ...current, [rank]: value }))
    try {
      await onFeedback(rank, value)
      setFeedbackStatus((current) => ({ ...current, [rank]: 'Feedback saved' }))
    } catch {
      setFeedbackChoice((current) => {
        const next = { ...current }
        delete next[rank]
        return next
      })
      setFeedbackStatus((current) => ({ ...current, [rank]: 'Feedback could not be saved' }))
    }
  }

  return (
    <section className="results-section" aria-labelledby="results-heading">
      <header className="results-heading">
        <div>
          <p className="section-kicker">Your shortlist</p>
          <h2 id="results-heading" tabIndex={-1}>
            Your best vacation windows
          </h2>
        </div>
        <p>
          Ranked by time away, leave efficiency, and fit. Every result uses the details you
          confirmed above.
        </p>
      </header>

      {result.notice && (
        <div className="results-notice" role="note">
          <InfoIcon />
          <p>{result.notice}</p>
        </div>
      )}

      {result.recommendations.length === 0 ? (
        <div className="empty-results">
          <CalendarIcon />
          <h3>No feasible vacation windows found.</h3>
          <p>Try a shorter break, another month, or a larger negative-day allowance.</p>
        </div>
      ) : (
        <ol className="recommendation-list">
          {result.recommendations.map((recommendation) => {
            const balanceFreeDays =
              recommendation.window.total_days - recommendation.window.vacation_days_used
            const matchingCount = recommendation.matching_window_count ?? 1
            const alternatives = recommendation.alternative_windows ?? []
            const hiddenAlternatives = matchingCount - 1 - alternatives.length
            return (
              <li key={`${recommendation.rank}-${recommendation.window.start_date}`}>
                <article
                  className={`recommendation-card ${recommendation.rank === 1 ? 'recommendation-card--best' : ''}`}
                >
                  <div className="recommendation-topline">
                    <div className="recommendation-title">
                      <span className="rank-number">
                        {String(recommendation.rank).padStart(2, '0')}
                      </span>
                      <div>
                        {recommendation.rank === 1 && <span className="best-badge">Best fit</span>}
                        <h3>
                          {recommendation.rank}. {dateWindow(recommendation.window)}
                        </h3>
                      </div>
                    </div>
                    {recommendation.score_breakdown ? (
                      <details className="score-details">
                        <summary className="score-pill">
                          Score {recommendation.score} <InfoIcon />
                        </summary>
                        <div className="score-explanation">
                          <strong>How this score adds up</strong>
                          <p>Weighted points for this break, rounded to a score out of 100.</p>
                          <dl>
                            <div>
                              <dt>Leave efficiency</dt>
                              <dd>
                                {points(recommendation.score_breakdown.leave_efficiency.points)} /{' '}
                                {points(recommendation.score_breakdown.leave_efficiency.max_points)}
                              </dd>
                            </div>
                            <div>
                              <dt>Time away</dt>
                              <dd>
                                {points(recommendation.score_breakdown.time_away.points)} /{' '}
                                {points(recommendation.score_breakdown.time_away.max_points)}
                              </dd>
                            </div>
                            <div>
                              <dt>Length fit</dt>
                              <dd>
                                {points(recommendation.score_breakdown.length_fit.points)} /{' '}
                                {points(recommendation.score_breakdown.length_fit.max_points)}
                              </dd>
                            </div>
                          </dl>
                          <p>It measures fit to your plan, not the chance of getting time off.</p>
                        </div>
                      </details>
                    ) : (
                      <span className="score-pill">Score {recommendation.score}</span>
                    )}
                  </div>

                  <div className="metric-grid">
                    <div>
                      <CalendarIcon />
                      <p>{recommendation.window.total_days} total days off</p>
                      <span>Full break</span>
                    </div>
                    <div>
                      <LeaveIcon />
                      <p>{recommendation.window.vacation_days_used} vacation days used</p>
                      <span>From your balance</span>
                    </div>
                    <div>
                      <BalanceIcon />
                      <p>{recommendation.remaining_balance} vacation days remaining</p>
                      <span>After this break</span>
                    </div>
                    <div>
                      <SparkIcon />
                      <p>{balanceFreeDays} balance-free days</p>
                      <span>Weekends and holidays</span>
                    </div>
                  </div>

                  {matchingCount > 1 && (
                    <details className="alternative-dates">
                      <summary>
                        {matchingCount} matching date options · same score and vacation-day cost
                      </summary>
                      <ul>
                        {alternatives.map((window) => (
                          <li key={`${window.start_date}-${window.end_date}`}>
                            {dateWindow(window)}
                          </li>
                        ))}
                      </ul>
                      {hiddenAlternatives > 0 && (
                        <span>+{hiddenAlternatives} more matching dates</span>
                      )}
                    </details>
                  )}

                  <div className="recommendation-reason">
                    <span aria-hidden="true">
                      <SparkIcon />
                    </span>
                    <div>
                      <strong>Why this window works</strong>
                      <p>{recommendation.explanation}</p>
                    </div>
                  </div>

                  {recommendation.warnings.length > 0 && (
                    <ul
                      className="warning-list"
                      aria-label={`Warnings for recommendation ${recommendation.rank}`}
                    >
                      {recommendation.warnings.map((warning) => (
                        <li key={warning}>
                          <AlertIcon />
                          {warningText(warning, recommendation.remaining_balance)}
                        </li>
                      ))}
                    </ul>
                  )}

                  {onFeedback && (
                    <div
                      className="feedback-row"
                      aria-label={`Feedback for recommendation ${recommendation.rank}`}
                    >
                      <span>Would this option work for you?</span>
                      <div className="feedback-actions">
                        <button
                          type="button"
                          aria-label={`Thumbs up recommendation ${recommendation.rank}`}
                          aria-pressed={feedbackChoice[recommendation.rank] === 'thumbs_up'}
                          onClick={() => void saveFeedback(recommendation.rank, 'thumbs_up')}
                        >
                          <ThumbUpIcon /> Yes
                        </button>
                        <button
                          type="button"
                          aria-label={`Thumbs down recommendation ${recommendation.rank}`}
                          aria-pressed={feedbackChoice[recommendation.rank] === 'thumbs_down'}
                          onClick={() => void saveFeedback(recommendation.rank, 'thumbs_down')}
                        >
                          <ThumbDownIcon /> Not quite
                        </button>
                        {feedbackStatus[recommendation.rank] && (
                          <span className="feedback-status" role="status">
                            {feedbackStatus[recommendation.rank]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M6.5 2.5v4M13.5 2.5v4M3 8h14" />
    </svg>
  )
}

function LeaveIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 16c2.5-5.7 6.2-9.5 12-12-1 6-4.2 10.2-9.5 11.5" />
      <path d="M6.5 15.5c2-3 4-5.2 7-7.5" />
    </svg>
  )
}

function BalanceIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3v14M4 6h12M5 6l-2 5h4L5 6Zm10 0-2 5h4l-2-5Z" />
      <path d="M6 17h8" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5c.7 4 2.4 5.7 6.5 6.5-4.1.8-5.8 2.5-6.5 6.5C9.2 11.5 7.5 9.8 3.5 9 7.5 8.2 9.2 6.5 10 2.5Z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5M10 6h.01" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.7 18 17H2L10 2.7Z" />
      <path d="M10 7v5M10 14.7h.01" />
    </svg>
  )
}

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 8.5 9.8 3c.5-1 2.2-.5 2.2.8v3.7h3.7c1.1 0 1.8 1 1.5 2l-1.4 5c-.2.7-.8 1.2-1.5 1.2H7V8.5ZM3 8.5h4v7.2H3z" />
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7 11.5 2.8 5.5c.5 1 2.2.5 2.2-.8v-3.7h3.7c1.1 0 1.8-1 1.5-2l-1.4-5c-.2-.7-.8-1.2-1.5-1.2H7v7.2ZM3 4.3h4v7.2H3z" />
    </svg>
  )
}
