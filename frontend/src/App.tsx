import { useEffect, useRef, useState } from 'react'

import { getHealth, submitFeedback } from './api'
import type { RecommendationResponse, SessionInput, DateRange } from './api'
import RecommendationResults from './RecommendationResults'
import SearchForm from './SearchForm'
import ComparisonWorkspace from './ComparisonWorkspace'
import type { ComparisonDraft, ComparisonOrigin } from './ComparisonWorkspace'
import { emptyPlanning, planningFromSession } from './planning'

type HealthState = 'checking' | 'ready' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')
  const [results, setResults] = useState<RecommendationResponse | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const [planning, setPlanning] = useState(emptyPlanning)
  const [confirmedContext, setConfirmedContext] = useState<SessionInput | null>(null)
  const [mode, setMode] = useState<'search' | 'compare'>('search')
  const [comparisonDraft, setComparisonDraft] = useState<ComparisonDraft | null>(null)
  const [origin, setOrigin] = useState<ComparisonOrigin | undefined>()
  const [comparisonKey, setComparisonKey] = useState(0)
  const opener = useRef<HTMLElement | null>(null)

  const searchScroll = useRef(0)

  function openComparison(dates?: DateRange) {
    if (mode === 'compare') return
    searchScroll.current = window.scrollY
    opener.current = document.activeElement as HTMLElement
    if (dates && confirmedContext && sessionToken && results) {
      setComparisonDraft({ dates, planning: planningFromSession(confirmedContext) })
      setOrigin({ token: sessionToken, searchId: results.search_id, context: confirmedContext })
    } else {
      setComparisonDraft(
        (current) => current ?? { dates: { start_date: '', end_date: '' }, planning },
      )
      setOrigin(undefined)
    }
    setComparisonKey((value) => value + 1)
    setMode('compare')
  }

  function closeComparison() {
    if (mode === 'search') return
    setMode('search')
    setTimeout(() => {
      opener.current?.focus({ preventScroll: true })
      window.scrollTo({ top: searchScroll.current, behavior: 'instant' })
    }, 0)
  }

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
        <section className="hero" aria-labelledby="hero-heading" hidden={mode !== 'search'}>
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

        <nav
          className={`planning-tabs ${mode === 'compare' ? 'planning-tabs--compact' : ''}`}
          aria-label="Planning task"
        >
          <button type="button" aria-pressed={mode === 'search'} onClick={closeComparison}>
            Find dates
          </button>
          <button type="button" aria-pressed={mode === 'compare'} onClick={() => openComparison()}>
            Compare my dates
          </button>
        </nav>
        <div hidden={mode !== 'search'}>
          <SearchForm
            planning={planning}
            onPlanningChange={setPlanning}
            onResults={(result, token, context) => {
              setResults(result)
              setSessionToken(token)
              setConfirmedContext(context)
            }}
          />
          {results && (
            <RecommendationResults
              key={results.search_id}
              result={results}
              onCompare={(window) =>
                openComparison({ start_date: window.start_date, end_date: window.end_date })
              }
              onFeedback={async (rank, value) => {
                if (sessionToken === null) throw new Error('Session is unavailable')
                await submitFeedback(sessionToken, results.search_id, rank, value)
              }}
            />
          )}
        </div>
        {mode === 'compare' && comparisonDraft && (
          <ComparisonWorkspace
            key={comparisonKey}
            draft={comparisonDraft}
            onDraftChange={setComparisonDraft}
            origin={origin}
            onClose={closeComparison}
          />
        )}
      </main>

      <footer className="site-footer">
        <span>Vacation Window Planner</span>
        <span>Phase 0.5 · Make every leave day count</span>
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
