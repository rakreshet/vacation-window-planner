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
  alternative_windows?: Recommendation['window'][]
  matching_window_count?: number
  score_breakdown?: {
    leave_efficiency: { points: number; max_points: number }
    time_away: { points: number; max_points: number }
    length_fit: { points: number; max_points: number }
  } | null
}

export type RecommendationResponse = {
  search_id: string
  recommendations: Recommendation[]
  notice?: string | null
}

export type SessionInput = {
  time_zone?: string
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

function errorMessage(body: unknown, fallback: string): string {
  if (!isObject(body) || !isObject(body.error) || typeof body.error.message !== 'string') {
    return fallback
  }
  return body.error.message
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
    throw new Error(errorMessage(body, 'Search failed'))
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

export type DateRange = { start_date: string; end_date: string }
export type EligibilityReason =
  | { code: 'unavailable_dates'; dates: string[] }
  | { code: 'insufficient_notice'; earliest_start_date: string }
  | { code: 'over_budget'; required_days: number; permitted_days: number }
export type WindowAssessment = {
  window: Recommendation['window']
  charged_dates: string[]
  remaining_balance: number
  eligible: boolean
  eligibility_reasons: EligibilityReason[]
  warnings: ('full_balance' | 'negative_balance')[]
  day_details: {
    date: string
    charged: boolean
    kind:
      'extra_working_day' | 'personal_day_off' | 'public_holiday' | 'weekend' | 'ordinary_working'
    is_public_holiday: boolean
    is_weekend: boolean
    unavailable: boolean
  }[]
}
export type ComparedWindow = {
  assessment?: WindowAssessment | null
  window: Recommendation['window']
  charged_dates: string[]
  weekend_dates: string[]
  remaining_balance: number
  feasible: boolean
  warnings: string[]
}
export type ComparisonAlternative = {
  evaluation: ComparedWindow
  delta: {
    extra_days: number
    vacation_days_saved: number
    start_shift_days: number
    end_shift_days: number
  }
  explanation: string
}
export type ComparisonResponse = {
  comparison_id: string
  baseline: ComparedWindow
  save_leave: ComparisonAlternative[]
  longer_break: ComparisonAlternative[]
  policy: {
    version: string
    shift_days: number
    extra_days: number
    max_length_days: number
    result_limit: number
    generation_cap: number
  }
  notices: string[]
}
export class ComparisonError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}
export async function compareDates(
  token: string,
  dates: DateRange,
  sourceSearchId?: string,
): Promise<ComparisonResponse> {
  try {
    const response = await fetch(`${baseUrl()}/comparisons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...dates,
        ...(sourceSearchId ? { source_search_id: sourceSearchId } : {}),
      }),
    })
    const body: unknown = await response.json()
    if (
      !response.ok ||
      !isObject(body) ||
      !isObject(body.baseline) ||
      !Array.isArray(body.save_leave) ||
      !Array.isArray(body.longer_break)
    ) {
      const code =
        isObject(body) && isObject(body.error) && typeof body.error.code === 'string'
          ? body.error.code
          : 'COMPARISON_ERROR'
      throw new ComparisonError(
        errorMessage(body, 'Comparison is unavailable. Your dates have been kept; try again.'),
        code,
      )
    }
    return body as ComparisonResponse
  } catch (error) {
    if (error instanceof ComparisonError) throw error
    throw new ComparisonError(
      'Comparison is unavailable. Your dates have been kept; try again.',
      'COMPARISON_ERROR',
    )
  }
}
