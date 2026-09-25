import { useEffect, useState } from 'react'

import { getHealth, submitFeedback } from './api'
import type { RecommendationResponse } from './api'
import RecommendationResults from './RecommendationResults'
import SearchForm from './SearchForm'

type HealthState = 'checking' | 'ready' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')
  const [results, setResults] = useState<RecommendationResponse | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const data = await getHealth(controller.signal)
        if (data.status === 'ok') {
          setHealth('ready')
        } else {
          setHealth('unavailable')
        }
      } catch {
        if (!controller.signal.aborted) setHealth('unavailable')
      }
    }

    void checkHealth()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (results === null) return
    const heading = document.getElementById('results-heading')
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [results])

  const message = {
    checking: 'Checking service…',
    ready: 'Service ready',
    unavailable: 'Service unavailable',
  }[health]

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Vacation Window Planner home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36" role="img">
              <path d="M8 11.5h20v17H8z" />
              <path d="M12 7.5v7M24 7.5v7M8 16h20" />
              <path d="m14 22 2.5 2.5L22 19" />
            </svg>
          </span>
          <span>
            <strong>Vacation Window</strong>
            <small>Planner</small>
          </span>
        </a>
        <div className={`service-status service-status--${health}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {message}
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">Make every leave day count</p>
            <h1 id="hero-heading">
              Turn vacation days into <span>longer breaks.</span>
            </h1>
            <p className="hero-lede">
              Find the strongest windows around weekends and public holidays—ranked around your
              balance, your calendar, and the way you want to travel.
            </p>
            <ul className="trust-list" aria-label="Planning benefits">
              <li>
                <CheckIcon /> Holiday-aware
              </li>
              <li>
                <CheckIcon /> Explainable results
              </li>
              <li>
                <CheckIcon /> No account needed
              </li>
            </ul>
          </div>

          <aside className="value-preview" aria-label="Example planning value">
            <div className="preview-orbit preview-orbit--one" />
            <div className="preview-orbit preview-orbit--two" />
            <div className="preview-card">
              <p className="preview-label">A smarter break</p>
              <div className="preview-scoreline">
                <div>
                  <strong>7</strong>
                  <span>days away</span>
                </div>
                <span className="preview-arrow" aria-hidden="true">
                  →
                </span>
                <div>
                  <strong>3</strong>
                  <span>leave days</span>
                </div>
              </div>
              <div className="preview-calendar" aria-hidden="true">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                  <span key={`${day}-${index}`} className={index > 3 ? 'is-free' : undefined}>
                    {day}
                  </span>
                ))}
              </div>
              <p className="preview-note">Example · your results use your real inputs</p>
            </div>
          </aside>
        </section>

        <SearchForm
          onResults={(result, token) => {
            setResults(result)
            setSessionToken(token)
          }}
        />
        {results && (
          <RecommendationResults
            result={results}
            onFeedback={async (rank, value) => {
              if (sessionToken === null) throw new Error('Session is unavailable')
              await submitFeedback(sessionToken, results.search_id, rank, value)
            }}
          />
        )}
      </main>

      <footer className="site-footer">
        <span>Vacation Window Planner</span>
        <span>Phase 0 · Dates, not destinations</span>
      </footer>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 10.5 3 3 7-7" />
    </svg>
  )
}
