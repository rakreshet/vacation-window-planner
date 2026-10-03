import { z } from 'zod'
import { canonicalJson } from './actionSnapshots'
import { AnnualError } from './annualApi'
import {
  annualContextSchema,
  annualRequestSchema,
  annualRunSchema,
  type AnnualRequest,
} from './annualContracts'
import type { AnnualResult } from './savedAnnualPlans'

const responseSchema = z.strictObject({
  input: annualRequestSchema,
  baseline_days: z.number().int().min(0).max(366),
  calculation_context: annualContextSchema,
  scenarios: z
    .array(
      z.strictObject({
        available_days: z.number().int().min(0).max(366),
        outcome: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(3),
})
export type BudgetComparison = {
  input: AnnualRequest
  baseline_days: number
  calculation_context: z.infer<typeof annualContextSchema>
  scenarios: { available_days: number; outcome: AnnualResult }[]
}

export async function compareAnnualBudgets(
  token: string,
  input: AnnualRequest,
  planning: z.infer<typeof annualContextSchema>['planning'],
  signal?: AbortSignal,
): Promise<BudgetComparison> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/annual-plans/budget-comparison`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const body: unknown = await response.json()
  if (!response.ok)
    throw new AnnualError('Budget comparison is unavailable. Try again.', 'SERVICE_UNAVAILABLE')
  try {
    const parsed = responseSchema.parse(body)
    const expectedBudgets = [
      planning.balance_days - 1,
      planning.balance_days,
      planning.balance_days + 1,
    ].filter((days) => days >= input.reserve_days && days >= 0 && days <= 366)
    if (
      parsed.baseline_days !== planning.balance_days ||
      canonicalJson(parsed.input) !== canonicalJson(input) ||
      canonicalJson(parsed.calculation_context.planning) !== canonicalJson(planning) ||
      canonicalJson(parsed.scenarios.map((scenario) => scenario.available_days)) !==
        canonicalJson(expectedBudgets)
    )
      throw new Error('Inconsistent comparison')
    const calendar = canonicalJson(parsed.scenarios[0].outcome.year_calendar)
    return {
      ...parsed,
      scenarios: parsed.scenarios.map((scenario) => {
        const verified = annualRunSchema.parse({
          ...scenario.outcome,
          run_id: '00000000-0000-4000-8000-000000000000',
          calculation_context: {
            ...parsed.calculation_context,
            planning: {
              ...parsed.calculation_context.planning,
              balance_days: scenario.available_days,
            },
          },
        })
        if (
          canonicalJson(verified.input) !== canonicalJson(input) ||
          canonicalJson(verified.year_calendar) !== calendar ||
          verified.plans.length > 1 ||
          verified.plans.some((plan) => plan.objective !== 'most_days_away')
        )
          throw new Error('Inconsistent scenario')
        const start = Date.parse(`${input.year}-01-01`)
        const end = Date.parse(`${input.year}-12-31`)
        if (
          verified.year_calendar.length !== (end - start) / 86400000 + 1 ||
          verified.year_calendar.some(
            (day, index) => Date.parse(day.date) !== start + index * 86400000,
          ) ||
          verified.plans.some((plan) =>
            plan.breaks.some((item) =>
              item.day_details.some(
                (day) =>
                  canonicalJson(day) !==
                  canonicalJson(verified.year_calendar.find((entry) => entry.date === day.date)),
              ),
            ),
          )
        )
          throw new Error('Inconsistent calendar')
        return {
          available_days: scenario.available_days,
          outcome: Object.fromEntries(
            Object.entries(verified).filter(([key]) => key !== 'run_id'),
          ) as AnnualResult,
        }
      }),
    }
  } catch {
    throw new AnnualError(
      'The budget comparison could not be verified. Try again.',
      'INVALID_RESPONSE',
    )
  }
}
