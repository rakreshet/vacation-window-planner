import { useEffect, useState } from 'react'

import { getHealth } from './api'
import type { RecommendationResponse } from './api'
import RecommendationResults from './RecommendationResults'
import SearchForm from './SearchForm'

type HealthState = 'checking' | 'ready' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')
  const [results, setResults] = useState<RecommendationResponse | null>(null)

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

  const message = {
    checking: 'Checking service…',
    ready: 'Service ready',
    unavailable: 'Service unavailable',
  }[health]

  return (
    <main>
      <h1>Vacation Window Planner</h1>
      <p>Find the best time to take a break.</p>
      <p role="status">{message}</p>
      <SearchForm onResults={setResults} />
      {results && <RecommendationResults result={results} />}
    </main>
  )
}
