import type { Recommendation, RecommendationResponse } from './api'

type RecommendationResultsProps = {
  result: RecommendationResponse
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

export default function RecommendationResults({ result }: RecommendationResultsProps) {
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
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
