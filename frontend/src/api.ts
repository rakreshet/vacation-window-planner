export type HealthResponse = {
  status: 'ok' | 'unavailable'
  database: 'connected' | 'disconnected'
}

export type YearMonth = { year: number; month: number }

export type InterpretationProposal = {
  source_text: string
  balance_days: number | null
  allowed_negative_days: number
  country_code: string | null
  months: YearMonth[]
  preferred_length_days: number | null
  weekend_days: number[] | null
  missing_fields: string[]
}

export type Recommendation = {
  window: {
    start_date: string
    end_date: string
    total_days: number
    vacation_days_used: number
    holiday_dates: string[]
  }
  rank: number
  score: number
  explanation: string
  remaining_balance: number
  warnings: string[]
}

export type RecommendationResponse = {
  search_id: string
  recommendations: Recommendation[]
  notice?: string | null
}

export type SessionInput = {
  balance_days: number
  allowed_negative_days: number
  country_code: string
  weekend_days: number[]
}

export type SearchInput = {
  months: YearMonth[]
  preferred_length_days: number
  result_limit: number
  source_text: string | null
}

export type FeedbackValue = 'thumbs_up' | 'thumbs_down'

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  const response = await fetch(`${baseUrl()}/health`, { signal })
  const body: unknown = await response.json()
  if (!isHealthResponse(body)) throw new Error('Invalid health response')
  if (!response.ok) throw new Error('Service unavailable')
  return body
}

export async function interpretText(text: string): Promise<InterpretationProposal> {
  const response = await fetch(`${baseUrl()}/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const body: unknown = await response.json()
  if (!response.ok || !isObject(body) || !Array.isArray(body.months)) {
    throw new Error('Text interpretation is unavailable')
  }
  return body as InterpretationProposal
}

export async function createSession(input: SessionInput): Promise<string> {
  const response = await fetch(`${baseUrl()}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body: unknown = await response.json()
  if (!response.ok || !isObject(body) || typeof body.token !== 'string') {
    throw new Error('Could not create an anonymous session')
  }
  return body.token
}

export async function searchRecommendations(
  token: string,
  input: SearchInput,
): Promise<RecommendationResponse> {
  const response = await fetch(`${baseUrl()}/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  const body: unknown = await response.json()
  if (!response.ok || !isObject(body) || !Array.isArray(body.recommendations)) {
    throw new Error('Search failed')
  }
  return body as RecommendationResponse
}

export async function submitFeedback(
  token: string,
  searchId: string,
  rank: number,
  value: FeedbackValue,
): Promise<void> {
  const response = await fetch(`${baseUrl()}/recommendations/${searchId}/${rank}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value }),
  })
  if (!response.ok) throw new Error('Could not save feedback')
}
