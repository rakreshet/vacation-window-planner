import ThemeSettings from './ThemeSettings'
import { Icon, EscapeScene } from './InterfaceArtwork'
import SavedAnnualPlansView from './SavedAnnualPlansView'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import type { PlanningDraft } from './planning'
import SavedOptionsView from './SavedOptionsView'
import type { ActionSnapshot } from './actionSnapshots'
import { useEffect, useRef, useState } from 'react'

import { getHealth, submitFeedback } from './api'
import type { RecommendationResponse, SessionInput, DateRange } from './api'
import OpportunitySection from './OpportunitySection'
import RecommendationResults from './RecommendationResults'
import SearchForm from './SearchForm'
import ComparisonWorkspace from './ComparisonWorkspace'
import type { ComparisonDraft, ComparisonOrigin } from './ComparisonWorkspace'
import { emptyPlanning, planningFromSession } from './planning'

type HealthState = 'checking' | 'ready' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')
  const [searchStale, setSearchStale] = useState(false)
  const [results, setResults] = useState<RecommendationResponse | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const [planning, setPlanning] = useState(emptyPlanning)
  const [confirmedContext, setConfirmedContext] = useState<SessionInput | null>(null)
  const [savedTab, setSavedTab] = useState<'vacations' | 'annual'>('vacations')
  const [mode, setMode] = useState<'search' | 'compare' | 'saved' | 'annual'>('search')
  const [comparisonDraft, setComparisonDraft] = useState<ComparisonDraft | null>(null)
  const [origin, setOrigin] = useState<ComparisonOrigin | undefined>()
  const [comparisonKey, setComparisonKey] = useState(0)
  const opener = useRef<HTMLElement | null>(null)

  const [annualPlanning, setAnnualPlanning] = useState<PlanningDraft | null>(null)
  const [savedVisited, setSavedVisited] = useState(false)
  const [savedCheck, setSavedCheck] = useState<ComparisonDraft | null>(null)
  const savedOpener = useRef<HTMLElement | null>(null)
  function checkSaved(snapshot: ActionSnapshot) {
    savedOpener.current = document.activeElement as HTMLElement
    setSavedCheck({
      dates: { start_date: snapshot.window.start_date, end_date: snapshot.window.end_date },
      planning: planningFromSession(snapshot.context.planning),
    })
    setMode('compare')
  }
  function leaveSavedCheck() {
    setSavedCheck(null)
    setMode('saved')
    setTimeout(() => savedOpener.current?.focus(), 0)
  }

  const searchScroll = useRef(0)

  function openComparison(dates?: DateRange) {
    if (savedCheck) {
      setSavedCheck(null)
      setComparisonDraft(
        (current) => current ?? { dates: { start_date: '', end_date: '' }, planning },
      )
      setMode('compare')
      return
    }
    if (mode === 'compare' || (dates && searchStale)) return
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
    if (dates || !comparisonDraft) setComparisonKey((value) => value + 1)
    setMode('compare')
  }

  function closeComparison() {
    if (mode === 'search') return
    setSavedCheck(null)
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
    heading?.scrollIntoView?.({ block: 'start' })
  }, [results])

  useEffect(() => {
    if (mode === 'annual') document.getElementById('annual-heading')?.focus({ preventScroll: true })
  }, [mode])

  const message = {
    checking: 'Checking service…',
    ready: 'Service ready',
    unavailable: 'Service unavailable',
  }[health]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#top">
        Skip to planner
      </a>
      <aside className="app-sidebar">
        <a
          className="brand"
          href="#top"
          onClick={closeComparison}
          aria-label="Vacation Window Planner home"
        >
          <span className="brand-mark">
            <Icon name="compass" />
          </span>
          <span>
            <strong>
              Vacation Window<span className="brand-period">.</span>
            </strong>
            <small>A little more time away</small>
          </span>
        </a>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav className="workspace-nav" aria-label="Planning task">
          <button type="button" aria-pressed={mode === 'search'} onClick={closeComparison}>
            <Icon name="compass" />
            <span>Find dates</span>
            <span className="nav-active-dot" />
          </button>
          <button type="button" aria-pressed={mode === 'compare'} onClick={() => openComparison()}>
            <Icon name="compare" />
            <span>Compare my dates</span>
            <span className="nav-active-dot" />
          </button>
          <button
            type="button"
            aria-pressed={mode === 'annual'}
            onClick={() => {
              setAnnualPlanning((current) => current ?? structuredClone(planning))
              setMode('annual')
            }}
          >
            <Icon name="calendar" />
            <span>Plan my year</span>
            <span className="nav-active-dot" />
          </button>
          <button
            type="button"
            aria-pressed={mode === 'saved'}
            onClick={() => {
              setSavedCheck(null)
              setSavedVisited(true)
              setMode('saved')
            }}
          >
            <Icon name="bookmark" />
            <span>Saved options</span>
            <span className="nav-active-dot" />
          </button>
        </nav>
        <ThemeSettings />
        <div className="sidebar-note">
          <Icon name="sun" />
          <p>
            Good things happen
            <br />
            <em>when you take a break.</em>
          </p>
          <span>Make room for your next one.</span>
        </div>
        <div className="sidebar-bottom">
          <Icon name="shield" />
          <span>
            No account needed<small>Just a little room to explore.</small>
          </span>
        </div>
      </aside>
      <div className="app-content">
        <header className="workspace-header">
          <div>
            <span className="breadcrumb">Your workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {
                {
                  search: 'Find dates',
                  compare: 'Compare my dates',
                  annual: 'Plan my year',
                  saved: 'Saved options',
                }[mode]
              }
            </strong>
          </div>
          <div className={`service-status service-status--${health}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {message}
          </div>
        </header>
        <main id="top" tabIndex={-1}>
          <section className="hero" aria-labelledby="hero-heading" hidden={mode !== 'search'}>
            <div className="hero-copy">
              <p className="eyebrow">
                <span /> LESS LEAVE. MORE LIFE.
              </p>
              <h1 id="hero-heading">
                Your next great break, <br />
                <em>hiding in your calendar.</em>
              </h1>
              <p className="hero-lede">
                Turn weekends and public holidays into more time for you.
                <br className="desktop-break" /> Let’s find the dates that make your leave go
                further.
              </p>
              <div className="hero-caption">
                <Icon name="calendar" />
                <span>Your calendar. Your balance. Your kind of break.</span>
              </div>
            </div>
            <div className="hero-art">
              <EscapeScene />
              <div className="scene-label">
                <Icon name="spark" /> A little planning. A lot more possibility.
              </div>
            </div>
          </section>
          <div hidden={mode !== 'search'}>
            <SearchForm
              planning={planning}
              onDraftChange={() => setSearchStale(true)}
              onPlanningChange={(value) => {
                setPlanning(value)
                setSearchStale(true)
              }}
              onResults={(result, token, context) => {
                setSearchStale(false)
                setResults(result)
                setSessionToken(token)
                setConfirmedContext(context)
              }}
            />
            {results && (
              <RecommendationResults
                key={results.search_id}
                visible={mode === 'search'}
                result={results}
                stale={searchStale}
                onCompare={(window) =>
                  openComparison({ start_date: window.start_date, end_date: window.end_date })
                }
                onFeedback={async (rank, value) => {
                  if (sessionToken === null) throw new Error('Session is unavailable')
                  await submitFeedback(sessionToken, results.search_id, rank, value)
                }}
              />
            )}
            {results?.opportunities && (
              <OpportunitySection
                result={results.opportunities}
                context={results.calculation_context}
                stale={searchStale}
                onCompare={(window) =>
                  openComparison({ start_date: window.start_date, end_date: window.end_date })
                }
              />
            )}
          </div>
          {annualPlanning && (
            <div hidden={mode !== 'annual'}>
              <AnnualPlanWorkspace initialPlanning={annualPlanning} visible={mode === 'annual'} />
            </div>
          )}
          {comparisonDraft && (
            <div hidden={mode !== 'compare' || Boolean(savedCheck)}>
              <ComparisonWorkspace
                key={comparisonKey}
                visible={mode === 'compare' && !savedCheck}
                draft={comparisonDraft}
                onDraftChange={setComparisonDraft}
                origin={origin}
                onClose={closeComparison}
              />
            </div>
          )}
          {savedCheck && mode === 'compare' && (
            <ComparisonWorkspace
              idPrefix="saved-compare-"
              draft={savedCheck}
              onDraftChange={setSavedCheck}
              onClose={leaveSavedCheck}
            />
          )}
          {savedVisited && (
            <div hidden={mode !== 'saved'}>
              <nav className="planning-tabs" aria-label="Saved categories">
                <button
                  type="button"
                  aria-pressed={savedTab === 'vacations'}
                  onClick={() => setSavedTab('vacations')}
                >
                  Vacations
                </button>
                <button
                  type="button"
                  aria-pressed={savedTab === 'annual'}
                  onClick={() => setSavedTab('annual')}
                >
                  Annual plans
                </button>
              </nav>
              <div hidden={savedTab !== 'vacations'}>
                <SavedOptionsView onCheck={checkSaved} onExplore={closeComparison} />
              </div>
              <div hidden={savedTab !== 'annual'}>
                <SavedAnnualPlansView
                  visible={mode === 'saved' && savedTab === 'annual'}
                  onPlan={() => {
                    setAnnualPlanning((current) => current ?? structuredClone(planning))
                    setMode('annual')
                  }}
                />
              </div>
            </div>
          )}
        </main>

        <footer className="site-footer">
          <span>Vacation Window Planner</span>
          <span>Less leave. More life.</span>
        </footer>
      </div>
    </div>
  )
}
