import { z } from 'zod'
import { annualSlotSchema } from './annualContracts'
import type { AnnualDraft } from './annualDraft'

const proposedSlot = z
  .object({
    label: z.string().min(1).max(80),
    min_days: z.number().int(),
    max_days: z.number().int(),
    locked_dates: z
      .object({ start_date: z.iso.date(), end_date: z.iso.date() })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (slot) =>
      annualSlotSchema.safeParse({
        slot_id: 'proposal',
        min_days: slot.min_days,
        max_days: slot.max_days,
        locked_dates: slot.locked_dates ?? null,
      }).success,
  )
export const annualProposalSchema = z
  .object({
    year: z.number().int().min(1).max(9999).optional(),
    available_days: z.number().int().min(0).max(366).optional(),
    minimum_gap_days: z.number().int().min(0).max(60).optional(),
    slots: z.array(proposedSlot).min(1).max(6).optional(),
    reserve_days: z.number().int().min(0).max(366).optional(),
    allowed_start_months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
    references: z.array(z.object({ description: z.string().min(1).max(200) }).strict()).max(6),
    assumptions: z.array(z.string()).max(12),
  })
  .strict()
export type AnnualProposal = z.infer<typeof annualProposalSchema>

export async function interpretAnnual(text: string, draft: AnnualDraft): Promise<AnnualProposal> {
  const localToday = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: draft.planning.timeZone,
  }).format(new Date())
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/annual-plans/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, year: Number(draft.year), local_today: localToday }),
  })
  if (!response.ok)
    throw new Error('Annual interpretation is unavailable. Use the structured fields or try again.')
  const parsed = annualProposalSchema.safeParse(await response.json())
  if (!parsed.success)
    throw new Error('The annual proposal could not be verified. Use the structured fields.')
  return parsed.data
}
