import { z } from 'zod'
import { canonicalJson } from './actionSnapshots'
import { annualRunSchema, type AnnualRun } from './annualContracts'
import type { OptionStorage } from './savedOptions'

export const savedAnnualPrefix = 'vacation-window:annual:v1:'
export type AnnualResult = Omit<AnnualRun, 'run_id'>
const resultSchema = z.custom<AnnualResult>((value) => {
  if (!value || typeof value !== 'object' || 'run_id' in value) return false
  const parsed = annualRunSchema.safeParse({
    ...value,
    run_id: '00000000-0000-4000-8000-000000000000',
  })
  if (!parsed.success || parsed.data.plans.length !== 1) return false
  const result = parsed.data
  const start = Date.parse(`${result.input.year}-01-01`)
  const end = Date.parse(`${result.input.year}-12-31`)
  if (result.year_calendar.length !== (end - start) / 86400000 + 1) return false
  if (
    !result.year_calendar.every((day, index) => Date.parse(day.date) === start + index * 86400000)
  )
    return false
  const calendar = new Map(result.year_calendar.map((day) => [day.date, day]))
  return result.plans[0].breaks.every((item) =>
    item.day_details.every((day) => canonicalJson(day) === canonicalJson(calendar.get(day.date))),
  )
})
export const annualSnapshotSchema = z
  .object({
    schema_version: z.literal(1),
    capture_id: z.string().regex(/^[a-f0-9]{64}$/),
    result: resultSchema,
  })
  .strict()
export type AnnualSnapshot = z.infer<typeof annualSnapshotSchema>
const savedAnnualSchema = z
  .object({
    schema_version: z.literal(1),
    name: z.string().trim().min(1).max(80),
    saved_at: z.iso.datetime({ offset: true }),
    snapshot: annualSnapshotSchema,
  })
  .strict()
export type SavedAnnualPlan = z.infer<typeof savedAnnualSchema>

export async function createAnnualSnapshot(
  run: AnnualRun,
  planId: string,
): Promise<AnnualSnapshot> {
  const plan = run.plans.find((item) => item.plan_id === planId)
  if (!plan) throw new Error('Choose an available annual plan')
  const result: AnnualResult = structuredClone({
    status: run.status,
    full_mix_feasibility: run.full_mix_feasibility,
    input: run.input,
    calculation_context: run.calculation_context,
    policy: run.policy,
    counters: run.counters,
    limit_reason: run.limit_reason,
    conflicts: run.conflicts,
    locked_assessments: run.locked_assessments,
    year_calendar: run.year_calendar,
    plans: [plan],
  })
  const identity = canonicalJson({
    schema_version: 1,
    input: result.input,
    planning: result.calculation_context.planning,
    accounting_version: result.calculation_context.accounting_version,
    policy_version: result.policy.version,
    year_calendar: result.year_calendar,
    breaks: plan.breaks,
    accounting: plan.accounting,
    fulfillment: plan.fulfillment,
    retained_slot_ids: plan.retained_slot_ids,
    omitted_slot_ids: plan.omitted_slot_ids,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const capture_id = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return annualSnapshotSchema.parse({ schema_version: 1, capture_id, result })
}

export class SavedAnnualPlansStore {
  constructor(private readonly storage: OptionStorage) {}
  list(): { items: SavedAnnualPlan[]; invalid: string[] } {
    const items: SavedAnnualPlan[] = []
    const invalid: string[] = []
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index)
      if (!key?.startsWith(savedAnnualPrefix)) continue
      try {
        const raw = this.storage.getItem(key) ?? ''
        if (new TextEncoder().encode(raw).length > 262144)
          throw new Error('Oversized annual record')
        const item = savedAnnualSchema.parse(JSON.parse(raw))
        if (key !== savedAnnualPrefix + item.snapshot.capture_id)
          throw new Error('Invalid identity')
        items.push(item)
      } catch {
        invalid.push(key)
      }
    }
    return { items, invalid }
  }
  save(snapshot: AnnualSnapshot) {
    const key = savedAnnualPrefix + snapshot.capture_id
    const existing = this.storage.getItem(key)
    if (existing) {
      savedAnnualSchema.parse(JSON.parse(existing))
      return { status: 'already_saved' as const }
    }
    this.checkCapacity()
    this.write(key, {
      schema_version: 1,
      name: `${snapshot.result.input.year} annual plan`,
      saved_at: new Date().toISOString(),
      snapshot,
    })
    return { status: 'saved' as const }
  }
  rename(id: string, name: string) {
    const key = savedAnnualPrefix + id
    const item = savedAnnualSchema.parse(JSON.parse(this.storage.getItem(key) ?? ''))
    this.write(key, { ...item, name })
  }
  remove(id: string) {
    const key = id.startsWith(savedAnnualPrefix) ? id : savedAnnualPrefix + id
    const raw = this.storage.getItem(key)
    this.storage.removeItem(key)
    return { key, raw }
  }
  restore(removed: { key: string; raw: string | null }) {
    if (!removed.key.startsWith(savedAnnualPrefix)) throw new Error('Invalid annual record key')
    if (removed.raw === null) return
    if (this.storage.getItem(removed.key) !== null)
      throw new Error('This plan changed in another tab. Reload to view it.')
    this.checkCapacity()
    this.storage.setItem(removed.key, removed.raw)
  }
  private checkCapacity() {
    const { items, invalid } = this.list()
    if (items.length + invalid.length >= 20)
      throw new Error('You can save up to 20 annual plans. Remove one first.')
  }
  private write(key: string, item: SavedAnnualPlan) {
    const raw = JSON.stringify(savedAnnualSchema.parse(item))
    if (new TextEncoder().encode(raw).length > 262144)
      throw new Error('This plan exceeds the 256 KiB save limit. Copy or download it instead.')
    this.storage.setItem(key, raw)
  }
}
