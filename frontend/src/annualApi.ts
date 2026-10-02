import { z } from 'zod'
import { annualRunSchema, type AnnualRequest, type AnnualRun } from './annualContracts'

export class AnnualError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: string[] = [],
  ) {
    super(message)
  }
}
export async function generateAnnualPlans(
  token: string,
  input: AnnualRequest,
  signal?: AbortSignal,
): Promise<AnnualRun> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/annual-plans`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const error = z
      .object({
        error: z.object({ message: z.string(), code: z.string(), fields: z.array(z.string()) }),
      })
      .safeParse(body)
    throw error.success
      ? new AnnualError(error.data.error.message, error.data.error.code, error.data.error.fields)
      : new AnnualError('Annual planning is unavailable. Try again.', 'SERVICE_UNAVAILABLE')
  }
  const parsed = annualRunSchema.safeParse(body)
  if (!parsed.success)
    throw new AnnualError('The annual result could not be verified. Try again.', 'INVALID_RESPONSE')
  return parsed.data
}
