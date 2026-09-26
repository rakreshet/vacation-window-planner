import type { OpportunityResponse, Recommendation } from './api'
import { displayDate } from './ComparisonResults'

type OpportunitySectionProps = {
  result: OpportunityResponse
  stale: boolean
  onCompare: (window: Recommendation['window']) => void
}

export default function OpportunitySection({ result, stale, onCompare }: OpportunitySectionProps) {
  if (stale) return null
  const emptyMessage = {
    complete: 'No additional opportunities matched your calendar rules.',
    too_broad: 'Opportunity discovery reached its limit. Your Search results are complete.',
    unavailable: 'Opportunities are unavailable right now. Your Search results are complete.',
  }[result.status]
  return (
    <section className="opportunities-section" aria-labelledby="opportunities-heading">
      <p className="section-kicker">A little more flexibility</p>
      <h2 id="opportunities-heading">Other opportunities</h2>
      <p>
        Outside your selected months or length flexibility. These are scored separately from your
        Search results.
      </p>
      {result.items.length === 0 && <p role="status">{emptyMessage}</p>}
      <ul className="opportunity-list">
        {result.items.map((opportunity) => (
          <li key={opportunity.opportunity_id}>
            <h3>
              {displayDate(opportunity.window.start_date)} –{' '}
              {displayDate(opportunity.window.end_date)}
            </h3>
            <p>{opportunity.explanation}</p>
            <details>
              <summary>Opportunity score {opportunity.score}</summary>
              <p>Efficiency, time away, and low leave use; this is not a Search score.</p>
              <dl>
                {Object.entries(opportunity.score_breakdown).map(([name, component]) => (
                  <div key={name}>
                    <dt>{name.replaceAll('_', ' ')}</dt>
                    <dd>
                      {component.points.toFixed(1)} / {component.max_points}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
            <button
              className="button button--secondary"
              type="button"
              disabled={stale}
              onClick={() => onCompare(opportunity.window)}
            >
              Compare opportunity {displayDate(opportunity.window.start_date)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
