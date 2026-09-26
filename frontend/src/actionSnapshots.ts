import type { CalculationContext, Recommendation, WindowAssessment } from './api'

export type ActionSource =
  'search' | 'opportunity' | 'comparison_baseline' | 'comparison_alternative'
export type ActionMetadata = { explanation?: string; policy_version?: string }
export type ActionSnapshot = {
  metadata: ActionMetadata
  schema_version: 1
  capture_id: string
  export_uid: string
  source: ActionSource
  window: Recommendation['window']
  assessment: WindowAssessment
  context: CalculationContext
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function sanitizedContext(context: CalculationContext): CalculationContext {
  const planning = context.planning
  const calendar = planning.personal_calendar
  return {
    accounting_version: context.accounting_version,
    calculated_at: context.calculated_at,
    local_today: context.local_today,
    planning: {
      balance_days: planning.balance_days,
      allowed_negative_days: planning.allowed_negative_days,
      country_code: planning.country_code,
      time_zone: planning.time_zone,
      weekend_days: [...planning.weekend_days].sort(),
      personal_calendar: {
        schema_version: 1,
        minimum_notice_days: calendar.minimum_notice_days,
        date_overrides: calendar.date_overrides.map(({ start_date, end_date, kind }) => ({
          start_date,
          end_date,
          kind,
        })),
        unavailable_ranges: calendar.unavailable_ranges.map(({ start_date, end_date }) => ({
          start_date,
          end_date,
        })),
      },
    },
  }
}

export async function createActionSnapshot(
  source: ActionSource,
  window: Recommendation['window'],
  assessment: WindowAssessment,
  context: CalculationContext,
  metadata: ActionMetadata = {},
): Promise<ActionSnapshot> {
  if (canonicalJson(window) !== canonicalJson(assessment.window)) {
    throw new Error('Accounting does not match the selected dates')
  }
  const capturedWindow = structuredClone(window)
  const capturedAssessment = structuredClone(assessment)
  const capturedContext = sanitizedContext(context)
  const identity = canonicalJson({
    window: capturedWindow,
    assessment: capturedAssessment,
    planning: capturedContext.planning,
    accounting_version: capturedContext.accounting_version,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const captureId = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return {
    schema_version: 1,
    capture_id: captureId,
    export_uid: `${captureId}@vacation-window-planner`,
    source,
    metadata: { explanation: metadata.explanation, policy_version: metadata.policy_version },
    window: capturedWindow,
    assessment: capturedAssessment,
    context: capturedContext,
  }
}
