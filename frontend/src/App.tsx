import { useEffect, useState } from 'react'

type HealthState = 'checking' | 'ready' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        const data: unknown = await response.json()
        if (
          response.ok &&
          typeof data === 'object' &&
          data !== null &&
          'status' in data &&
          data.status === 'ok'
        ) {
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
    </main>
  )
}
