export type HealthResponse = {
  status: 'ok' | 'unavailable'
  database: 'connected' | 'disconnected'
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false
  if (!('status' in value) || !('database' in value)) return false
  return (
    (value.status === 'ok' && value.database === 'connected') ||
    (value.status === 'unavailable' && value.database === 'disconnected')
  )
}

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/health`, { signal })
  const body: unknown = await response.json()
  if (!isHealthResponse(body)) throw new Error('Invalid health response')
  if (!response.ok) throw new Error('Service unavailable')
  return body
}
