import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createActionSnapshot } from './actionSnapshots'
import { window, assessment, context } from './snapshotFixtures'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

test('the same exact accounting has one identity across surfaces and calculation timestamps', async () => {
  const first = await createActionSnapshot('search', window, assessment, context)
  const second = await createActionSnapshot('comparison_baseline', window, assessment, {
    ...context,
    calculated_at: '2026-09-26T13:00:00Z',
  })
  expect(first.capture_id).toBe(second.capture_id)
  expect(first.export_uid).toBe(second.export_uid)
  expect(first.assessment.charged_dates).toEqual([])
  expect(first.context.planning.time_zone).toBe('Asia/Jerusalem')
})

test('capturing a grouped alternative requires that exact assessment', async () => {
  const alternative = { ...window, start_date: '2027-01-14', end_date: '2027-01-16' }
  await expect(createActionSnapshot('search', alternative, assessment, context)).rejects.toThrow(
    'Accounting does not match the selected dates',
  )
})

test('capture copies accounting before hashing and strips ownership metadata', async () => {
  const mutableAssessment = structuredClone(assessment)
  const suppliedContext = {
    ...context,
    session_id: 'private-id',
    planning: { ...context.planning, token: 'secret' },
  }
  const pending = createActionSnapshot('search', window, mutableAssessment, suppliedContext)
  mutableAssessment.remaining_balance = 1
  const captured = await pending
  expect(captured.assessment.remaining_balance).toBe(8)
  expect(JSON.stringify(captured)).not.toContain('secret')
  expect(JSON.stringify(captured)).not.toContain('private-id')
})

test('capture retains descriptive metadata without changing identity', async () => {
  const original = await createActionSnapshot('search', window, assessment, context)
  const described = await createActionSnapshot('opportunity', window, assessment, context, {
    explanation: 'A longer break',
    policy_version: 'opportunity-v1',
  })
  expect(described.capture_id).toBe(original.capture_id)
  expect(described.metadata.explanation).toBe('A longer break')
  const changed = await createActionSnapshot('search', window, assessment, {
    ...context,
    planning: { ...context.planning, balance_days: 9 },
  })
  expect(changed.capture_id).not.toBe(original.capture_id)
})
