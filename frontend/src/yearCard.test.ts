import { webcrypto } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import { annualRunSchema } from './annualContracts'
import { annualFixtureWithAlternatives } from './annualFixtures'
import { createAnnualSnapshot } from './savedAnnualPlans'
import { sixBreakCardFixture } from './yearCardFixtures'
import { yearCardSvg } from './yearCard'

afterEach(() => vi.unstubAllGlobals())

async function snapshot() {
  vi.stubGlobal('crypto', webcrypto)
  const run = annualFixtureWithAlternatives()
  return createAnnualSnapshot(annualRunSchema.parse(run), 'b'.repeat(64))
}

function parse(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  expect(document.querySelector('parsererror')).toBeNull()
  return document
}

test('the year card contains only the selected plan, exact dates, calculation date and a neutral year calendar', async () => {
  const capture = await snapshot()
  const svg = yearCardSvg(capture, { title: 'A year to remember', includeLeaveDetails: false })
  const document = parse(svg)
  expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 1200 1800')
  expect(document.querySelectorAll('[data-month]')).toHaveLength(12)
  expect(document.querySelectorAll('[data-date]')).toHaveLength(365)
  expect(
    Array.from(document.querySelectorAll('[data-selected="true"]')).map((day) =>
      day.getAttribute('data-date'),
    ),
  ).toEqual([
    '2027-03-05',
    '2027-03-06',
    '2027-03-07',
    '2027-03-08',
    '2027-05-07',
    '2027-05-08',
    '2027-05-09',
    '2027-05-10',
    '2027-08-13',
    '2027-08-14',
    '2027-08-15',
    '2027-08-16',
    '2027-08-17',
    '2027-08-18',
    '2027-08-19',
    '2027-08-20',
    '2027-08-21',
  ])
  expect(document.documentElement.textContent).toContain('17 days away')
  expect(document.documentElement.textContent).toContain('3 breaks')
  expect(document.documentElement.textContent).toContain('2027-08-13 – 2027-08-21')
  expect(document.documentElement.textContent).toContain('Calculated 2026-09-26 · Asia/Jerusalem')
  expect(document.documentElement.textContent).toContain(
    'Proposed plan · leave approval is separate',
  )
  expect(document.querySelectorAll('script, image, foreignObject, a, style')).toHaveLength(0)
  for (const privateValue of [
    'available leave',
    'leave used',
    'remaining leave',
    'protected reserve',
    'personal_day_off',
    'unavailable',
    capture.capture_id,
    'b'.repeat(64),
    'short-1',
  ])
    expect(svg).not.toContain(privateValue)
})

test('leave figures appear only when explicitly included', async () => {
  const svg = yearCardSvg(await snapshot(), { title: 'My year', includeLeaveDetails: true })
  const content = parse(svg).documentElement.textContent
  expect(content).toContain(
    '18 available leave · 8 leave used · 10 remaining leave · 3 protected reserve',
  )
})

test('titles remain literal escaped XML and long names wrap inside the card', async () => {
  const capture = await snapshot()
  const short = '<script>alert("hello")</script> & friends'
  const document = parse(yearCardSvg(capture, { title: short, includeLeaveDetails: false }))
  expect(document.querySelector('script')).toBeNull()
  expect(
    Array.from(document.querySelectorAll('[data-title]'))
      .map((line) => line.textContent)
      .join(' '),
  ).toBe(short)
  const long = parse(yearCardSvg(capture, { title: 'W'.repeat(80), includeLeaveDetails: false }))
  const lines = Array.from(long.querySelectorAll('[data-title]'))
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.map((line) => line.textContent).join('')).toBe('W'.repeat(80))
  expect(
    lines.every((line) => line.textContent!.length <= 34 && Number(line.getAttribute('y')) <= 190),
  ).toBe(true)
})

test('leap-day cross-month locked dates and six chronological breaks stay inside the artifact', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const run = sixBreakCardFixture()
  const svg = yearCardSvg(await createAnnualSnapshot(run, run.plans[0].plan_id), {
    title: 'W'.repeat(80),
    includeLeaveDetails: true,
  })
  const document = parse(svg)
  expect(document.querySelectorAll('[data-date]')).toHaveLength(366)
  expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(21)
  expect(document.querySelector('[data-date="2028-02-29"]')?.getAttribute('data-locked')).toBe(
    'true',
  )
  expect(document.querySelector('[data-date="2028-03-02"]')?.getAttribute('data-selected')).toBe(
    'true',
  )
  expect(document.querySelector('[data-date="2028-03-03"]')?.getAttribute('data-selected')).toBe(
    'false',
  )
  expect(document.documentElement.textContent).toContain('Break 1 · locked dates')
  expect(document.documentElement.textContent).toContain('2028-12-02 – 2028-12-04')
  for (const rect of document.querySelectorAll('rect')) {
    expect(Number(rect.getAttribute('x')) + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(
      1200,
    )
    expect(
      Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')),
    ).toBeLessThanOrEqual(1800)
  }
  for (const text of document.querySelectorAll('text'))
    expect(Number(text.getAttribute('y'))).toBeLessThan(1800)
})

test('a reduced card names omitted breaks without claiming the full requested mix', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const run = sixBreakCardFixture(true)
  const svg = yearCardSvg(await createAnnualSnapshot(run, run.plans[0].plan_id), {
    title: 'My reduced year',
    includeLeaveDetails: false,
  })
  const document = parse(svg)
  expect(document.documentElement.textContent).toContain(
    'Reduced mix: 4 of 6 breaks · omitted: Break 5, Break 6',
  )
  expect(document.documentElement.textContent).toContain('15 days away')
  expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(15)
})

test('a single-break card uses singular wording', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const raw = annualFixtureWithAlternatives()
  raw.plans = [raw.plans[0]]
  const plan = raw.plans[0]
  raw.input.slots = raw.input.slots.filter((slot) => slot.slot_id === 'short-1')
  plan.breaks = plan.breaks.slice(0, 1)
  plan.retained_slot_ids = ['short-1']
  Object.assign(plan.accounting, {
    total_leave_used: 2,
    remaining_days: 16,
    unallocated_days: 13,
    total_days_away: 4,
    charged_dates: ['2027-03-07', '2027-03-08'],
  })
  const run = annualRunSchema.parse(raw)
  const document = parse(
    yearCardSvg(await createAnnualSnapshot(run, plan.plan_id), {
      title: 'A little time away',
      includeLeaveDetails: false,
    }),
  )
  expect(Array.from(document.querySelectorAll('text')).map((text) => text.textContent)).toContain(
    '1 break',
  )
})
