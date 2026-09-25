import { useState } from 'react'

import type { Recommendation, RecommendationResponse } from './api'
import type { FeedbackValue } from './api'

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

function dateWindow(recommendation: Recommendation): string {
  const start = dateParts(recommendation.window.start_date)
  const end = dateParts(recommendation.window.end_date)
  if (start.year === end.year) return `${start.monthDay} – ${end.monthDay}, ${end.year}`
  return `${start.monthDay}, ${start.year} – ${end.monthDay}, ${end.year}`
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

  async function saveFeedback(rank: number, value: FeedbackValue) {
    if (onFeedback === undefined) return
    try {
      await onFeedback(rank, value)
      setFeedbackStatus((current) => ({ ...current, [rank]: 'Feedback saved' }))
    } catch {
      setFeedbackStatus((current) => ({ ...current, [rank]: 'Feedback could not be saved' }))
    }
  }

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading">Recommendations</h2>
      {result.notice && <p role="note">{result.notice}</p>}
      {result.recommendations.length === 0 ? (
        <p>No feasible vacation windows found.</p>
      ) : (
        <ol>
          {result.recommendations.map((recommendation) => (
            <li key={`${recommendation.rank}-${recommendation.window.start_date}`}>
              <article>
                <h3>
                  {recommendation.rank}. {dateWindow(recommendation)}
                </h3>
                <p>{recommendation.window.total_days} total days off</p>
                <p>{recommendation.window.vacation_days_used} vacation days used</p>
                <p>{recommendation.remaining_balance} vacation days remaining</p>
                <p>Score {recommendation.score}</p>
                <p>{recommendation.explanation}</p>
                {recommendation.warnings.length > 0 && (
                  <ul aria-label={`Warnings for recommendation ${recommendation.rank}`}>
                    {recommendation.warnings.map((warning) => (
                      <li key={warning}>
                        {warningText(warning, recommendation.remaining_balance)}
                      </li>
                    ))}
                  </ul>
                )}
                {onFeedback && (
                  <div aria-label={`Feedback for recommendation ${recommendation.rank}`}>
                    <button
                      type="button"
                      aria-label={`Thumbs up recommendation ${recommendation.rank}`}
                      onClick={() => void saveFeedback(recommendation.rank, 'thumbs_up')}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      aria-label={`Thumbs down recommendation ${recommendation.rank}`}
                      onClick={() => void saveFeedback(recommendation.rank, 'thumbs_down')}
                    >
                      👎
                    </button>
                    {feedbackStatus[recommendation.rank] && (
                      <span role="status">{feedbackStatus[recommendation.rank]}</span>
                    )}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
