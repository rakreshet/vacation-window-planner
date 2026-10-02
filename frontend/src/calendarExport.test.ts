import { webcrypto } from 'node:crypto'
import ICAL from 'ical.js'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { createActionSnapshot } from './actionSnapshots'
import { window, assessment, context } from './snapshotFixtures'
import { calendarFile, leaveRequestText } from './calendarExport'
beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

test('calendar parser reads an all-day tentative event with an exclusive end and stable UID', async () => {
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  const text = calendarFile(snapshot, 'Winter break', new Date('2026-09-26T12:00:00Z'))
  const calendar = new ICAL.Component(ICAL.parse(text))
  const component = calendar.getFirstSubcomponent('vevent')!
  const event = new ICAL.Event(component)
  expect(event.startDate.toString()).toBe('2027-01-07')
  expect(event.endDate.toString()).toBe('2027-01-10')
  expect(event.startDate.isDate).toBe(true)
  expect(event.uid).toBe(snapshot.export_uid)
  expect(component.getFirstPropertyValue('status')).toBe('TENTATIVE')
  expect(component.getFirstPropertyValue('transp')).toBe('TRANSPARENT')
  expect(component.getFirstPropertyValue('attendee')).toBeNull()
  expect(leaveRequestText(snapshot)).toContain(
    'No vacation days are required under the recorded calendar',
  )
  expect(leaveRequestText(snapshot)).toContain('not an approval')
})

test('Unicode titles round-trip without injected properties and physical lines stay within 75 UTF-8 bytes', async () => {
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  const title = 'חופשה 🌴,;\\'.repeat(12) + '\nATTENDEE:untrusted'
  const text = calendarFile(snapshot, title)
  const event = new ICAL.Event(new ICAL.Component(ICAL.parse(text)).getFirstSubcomponent('vevent')!)
  expect(event.summary).toBe(title)
  expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
  expect(text.replaceAll('\r\n', '')).not.toContain('\n')
})

test('leave text includes every eligibility warning but omits unrelated planning context', async () => {
  const blocked = {
    ...assessment,
    eligible: false,
    warnings: ['negative_balance' as const],
    eligibility_reasons: [
      { code: 'unavailable_dates' as const, dates: ['2027-01-08'] },
      { code: 'insufficient_notice' as const, earliest_start_date: '2027-01-10' },
      { code: 'over_budget' as const, required_days: 3, permitted_days: 2 },
    ],
  }
  const snapshot = await createActionSnapshot('comparison_baseline', window, blocked, context)
  const text = leaveRequestText(snapshot)
  expect(text).toContain('Unavailable dates: 2027-01-08')
  expect(text).toContain('Minimum notice requires a start on or after 2027-01-10')
  expect(text).toContain('Exceeds the recorded leave allowance')
  expect(text).toContain('Uses a negative leave balance')
  expect(text).not.toContain('Asia/Jerusalem')
  expect(text).not.toContain('balance_days')
})

test.each([
  ['2027-12-31', '2028-01-01'],
  ['2027-03-14', '2027-03-15'],
  ['2028-02-29', '2028-03-01'],
])(
  'an end on %s exports the next local date %s without timezone arithmetic',
  async (end, exclusive) => {
    const snapshot = await createActionSnapshot('search', window, assessment, context)
    snapshot.window.end_date = end
    const event = new ICAL.Event(
      new ICAL.Component(ICAL.parse(calendarFile(snapshot))).getFirstSubcomponent('vevent')!,
    )
    expect(event.endDate.toString()).toBe(exclusive)
  },
)

test('calendar end overflow fails clearly while copying stays available', async () => {
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  snapshot.window.end_date = '9999-12-31'
  expect(() => calendarFile(snapshot)).toThrow('end date')
  expect(leaveRequestText(snapshot)).toContain('9999-12-31')
})
