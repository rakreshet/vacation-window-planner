import ICAL from 'ical.js'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { annualFixture } from './annualFixtures'
import { annualRunSchema } from './annualContracts'
import { createAnnualSnapshot } from './savedAnnualPlans'
import { annualCalendarFile, annualLeaveRequestText } from './annualCalendarExport'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

test('annual ICS parses as three tentative all-day events with stable distinct UIDs and exact dates', async () => {
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  const text = annualCalendarFile(snapshot, 'My year', false, new Date('2026-09-26T12:00:00Z'))
  const calendar = new ICAL.Component(ICAL.parse(text))
  const components = calendar.getAllSubcomponents('vevent')
  const events = components.map((component) => new ICAL.Event(component))
  expect(events.map((event) => [event.startDate.toString(), event.endDate.toString()])).toEqual([
    ['2027-03-05', '2027-03-09'],
    ['2027-05-07', '2027-05-11'],
    ['2027-08-06', '2027-08-15'],
  ])
  expect(new Set(events.map((event) => event.uid)).size).toBe(3)
  const repeated = new ICAL.Component(ICAL.parse(annualCalendarFile(snapshot, 'Renamed')))
    .getAllSubcomponents('vevent')
    .map((component) => new ICAL.Event(component).uid)
  expect(repeated).toEqual(events.map((event) => event.uid))
  for (const component of components) {
    expect(new ICAL.Event(component).startDate.isDate).toBe(true)
    expect(component.getFirstPropertyValue('status')).toBe('TENTATIVE')
    expect(component.getFirstPropertyValue('transp')).toBe('TRANSPARENT')
    expect(component.getFirstPropertyValue('attendee')).toBeNull()
  }
  const copy = annualLeaveRequestText(snapshot)
  expect(copy).toContain('Total vacation days required: 8')
  expect(copy).toContain('Working dates: 2027-03-07, 2027-03-08')
  expect(copy).not.toMatch(/reserve|available|remaining/i)
  expect(copy).not.toContain('2027-05-09')
})

test('reduced exports disclose omissions and include budget only when explicitly requested', async () => {
  const fixture = annualFixture()
  const plan = fixture.plans[0]
  const run = annualRunSchema.parse({
    ...fixture,
    status: 'infeasible',
    full_mix_feasibility: 'infeasible',
    conflicts: [{ code: 'mix_constraints', slot_ids: ['long', 'short-1', 'short-2'] }],
    plans: [
      {
        ...plan,
        fulfillment: 'reduced',
        retained_slot_ids: ['short-1', 'short-2'],
        omitted_slot_ids: ['long'],
        breaks: plan.breaks.slice(0, 2),
        accounting: {
          ...plan.accounting,
          total_leave_used: 3,
          remaining_days: 15,
          unallocated_days: 12,
          total_days_away: 8,
          charged_dates: ['2027-03-07', '2027-03-08', '2027-05-10'],
        },
      },
    ],
  })
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  expect(annualLeaveRequestText(snapshot)).toContain('Reduced plan: 2 of 3 requested breaks')
  expect(annualLeaveRequestText(snapshot)).toContain('Not included: Break 1 (7–14 days)')
  expect(annualLeaveRequestText(snapshot, true)).toContain(
    'Available: 18; used: 3; remaining: 15; protected reserve: 3; unallocated: 12.',
  )
  const text = annualCalendarFile(snapshot, 'חופשה,;\\'.repeat(20) + '\nATTENDEE:injected', true)
  const events = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent')
  expect(events).toHaveLength(2)
  expect(events[0].getFirstPropertyValue('description')).toContain(
    'Not included: Break 1 (7–14 days)',
  )
  expect(events[0].getFirstPropertyValue('description')).toContain('protected reserve: 3')
  expect(events[0].getFirstPropertyValue('attendee')).toBeNull()
  expect(new ICAL.Event(events[0]).summary).toBe('חופשה,;\\'.repeat(20) + '\nATTENDEE:injected')
  expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
})

test.each([
  [2027, '2027-12-29', '2027-12-31', '2028-01-01', ['2027-12-29', '2027-12-30']],
  [2028, '2028-02-27', '2028-02-29', '2028-03-01', ['2028-02-27', '2028-02-28', '2028-02-29']],
  [2027, '2027-03-12', '2027-03-14', '2027-03-15', ['2027-03-14']],
] as const)(
  'annual export preserves inclusive dates across %s %s–%s',
  async (year, start, end, exclusive, charged) => {
    const fixture = annualFixture()
    const calendar = Array.from({ length: year === 2028 ? 366 : 365 }, (_, index) => {
      const date = new Date(Date.UTC(year, 0, index + 1))
      const weekend = [5, 6].includes(date.getUTCDay())
      return {
        date: date.toISOString().slice(0, 10),
        charged: !weekend,
        kind: weekend ? 'weekend' : 'ordinary_working',
        is_public_holiday: false,
        is_weekend: weekend,
        unavailable: false,
      }
    })
    const count = charged.length
    const run = annualRunSchema.parse({
      ...fixture,
      input: {
        ...fixture.input,
        year,
        slots: [{ slot_id: 'long', min_days: 3, max_days: 3, locked_dates: null }],
      },
      year_calendar: calendar,
      calculation_context: {
        ...fixture.calculation_context,
        planning: {
          ...fixture.calculation_context.planning,
          personal_calendar: {
            schema_version: 1,
            minimum_notice_days: 0,
            unavailable_ranges: [],
            date_overrides: [],
          },
        },
      },
      plans: [
        {
          ...fixture.plans[0],
          retained_slot_ids: ['long'],
          breaks: [
            {
              slot_id: 'long',
              locked: false,
              notice_waived: false,
              balance_after_break: 18 - count,
              charged_dates: charged,
              day_details: calendar.filter((day) => day.date >= start && day.date <= end),
              window: {
                start_date: start,
                end_date: end,
                total_days: 3,
                vacation_days_used: count,
                holiday_dates: [],
              },
            },
          ],
          accounting: {
            ...fixture.plans[0].accounting,
            total_leave_used: count,
            remaining_days: 18 - count,
            unallocated_days: 15 - count,
            total_days_away: 3,
            charged_dates: charged,
          },
        },
      ],
    })
    const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
    const event = new ICAL.Event(
      new ICAL.Component(ICAL.parse(annualCalendarFile(snapshot))).getFirstSubcomponent('vevent')!,
    )
    expect(event.startDate.toString()).toBe(start)
    expect(event.endDate.toString()).toBe(exclusive)
  },
)
