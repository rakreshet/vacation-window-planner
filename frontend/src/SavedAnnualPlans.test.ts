import { beforeEach, expect, test, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { annualFixture } from './annualFixtures'
import { annualRunSchema } from './annualContracts'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { createAnnualSnapshot, SavedAnnualPlansStore } from './savedAnnualPlans'

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
})

test('saving captures one immutable plan without server identity and duplicate saves preserve its name', async () => {
  const storage = new MemoryOptionStorage()
  const store = new SavedAnnualPlansStore(storage)
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  expect(store.save(snapshot).status).toBe('saved')
  store.rename(snapshot.capture_id, 'My year')
  run.run_id = '00000000-0000-4000-8000-000000000099'
  run.calculation_context.calculated_at = '2026-09-27T12:00:00Z'
  const repeated = await createAnnualSnapshot(run, run.plans[0].plan_id)
  expect(repeated.capture_id).toBe(snapshot.capture_id)
  expect(store.save(repeated).status).toBe('already_saved')
  expect(new SavedAnnualPlansStore(storage).list().items[0].name).toBe('My year')
  const raw = storage.getItem(storage.key(0)!)!
  expect(raw).not.toContain('run_id')
  expect(raw).not.toContain('token')
  expect(JSON.parse(raw).snapshot.result.plans).toHaveLength(1)
  expect(snapshot.result.calculation_context.calculated_at).toBe('2026-09-26T12:00:00Z')
})

test('annual storage limits and corrupt records never remove existing plans or individual vacations', async () => {
  const storage = new MemoryOptionStorage()
  const store = new SavedAnnualPlansStore(storage)
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  store.save(snapshot)
  storage.setItem('vacation-window:saved:v1:existing', 'individual record')
  for (let index = 0; index < 19; index++)
    storage.setItem(`vacation-window:annual:v1:broken-${index}`, '{invalid')
  const next = structuredClone(snapshot)
  next.capture_id = 'c'.repeat(64)
  expect(() => store.save(next)).toThrow('20 annual plans')
  expect(store.list().items).toHaveLength(1)
  expect(store.list().invalid).toHaveLength(19)
  expect(storage.getItem('vacation-window:saved:v1:existing')).toBe('individual record')
  expect(() => store.rename(snapshot.capture_id, 'x'.repeat(81))).toThrow()
  expect(store.list().items[0].name).toBe('2027 annual plan')
})

test('failed writes and undo collisions preserve the last successful record', async () => {
  class FailingStorage extends MemoryOptionStorage {
    blocked = false
    override setItem(key: string, value: string) {
      if (this.blocked) throw new Error('quota exceeded')
      super.setItem(key, value)
    }
  }
  const storage = new FailingStorage()
  const store = new SavedAnnualPlansStore(storage)
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  storage.blocked = true
  expect(() => store.save(snapshot)).toThrow('quota')
  expect(store.list().items).toHaveLength(0)
  storage.blocked = false
  store.save(snapshot)
  const removed = store.remove(snapshot.capture_id)
  expect(store.list().items).toHaveLength(0)
  storage.blocked = true
  expect(() => store.restore(removed)).toThrow('quota')
  storage.blocked = false
  store.restore(removed)
  new SavedAnnualPlansStore(storage).rename(snapshot.capture_id, 'Other tab')
  expect(() => store.restore(removed)).toThrow('another tab')
  expect(store.list().items[0].name).toBe('Other tab')
})

test('read and write reject inconsistent year facts, unsupported versions and oversized records', async () => {
  const storage = new MemoryOptionStorage()
  const store = new SavedAnnualPlansStore(storage)
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  const missingDay = structuredClone(snapshot)
  missingDay.result.year_calendar.pop()
  expect(() => store.save(missingDay)).toThrow()
  const wrongDay = structuredClone(snapshot)
  wrongDay.result.year_calendar.find((day) => day.date === '2027-03-07')!.charged = false
  expect(() => store.save(wrongDay)).toThrow()
  store.save(snapshot)
  const key = storage.key(0)!
  const raw = storage.getItem(key)!
  storage.setItem(key, raw + ' '.repeat(262144))
  expect(store.list().items).toHaveLength(0)
  expect(store.list().invalid).toEqual([key])
  storage.setItem(key, JSON.stringify({ ...JSON.parse(raw), schema_version: 2 }))
  expect(store.list().invalid).toEqual([key])
})

test('changed annual constraints create a distinct capture while objective labels do not', async () => {
  const run = annualRunSchema.parse(annualFixture())
  const first = await createAnnualSnapshot(run, run.plans[0].plan_id)
  run.plans[0].objective = 'different_dates'
  expect((await createAnnualSnapshot(run, run.plans[0].plan_id)).capture_id).toBe(first.capture_id)
  run.input.reserve_days = 4
  run.plans[0].accounting.reserve_days = 4
  run.plans[0].accounting.spendable_days = 14
  run.plans[0].accounting.unallocated_days = 6
  expect((await createAnnualSnapshot(run, run.plans[0].plan_id)).capture_id).not.toBe(
    first.capture_id,
  )
})

test('a stored plan with an invalid time zone is isolated before reopening can crash', async () => {
  const storage = new MemoryOptionStorage()
  const store = new SavedAnnualPlansStore(storage)
  const run = annualRunSchema.parse(annualFixture())
  store.save(await createAnnualSnapshot(run, run.plans[0].plan_id))
  const key = storage.key(0)!
  const record = JSON.parse(storage.getItem(key)!)
  record.snapshot.result.calculation_context.planning.time_zone = 'Invalid/Timezone'
  storage.setItem(key, JSON.stringify(record))
  expect(store.list().items).toHaveLength(0)
  expect(store.list().invalid).toEqual([key])
})
