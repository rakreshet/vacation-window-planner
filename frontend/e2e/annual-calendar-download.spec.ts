import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import ICAL from 'ical.js'
import { annualFixture, annualFixtureWithAlternatives } from '../src/annualFixtures'
import { annualRunSchema, type AnnualRun } from '../src/annualContracts'

async function openAnnualPlanner(page: Page, result: AnnualRun) {
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'))
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', database: 'connected' } }),
  )
  await page.route('**/api/sessions', (route) =>
    route.fulfill({ json: { token: 'annual-browser-test-token' } }),
  )
  await page.route('**/api/annual-plans', (route) => route.fulfill({ json: result }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Plan my year', exact: true }).click()
  const annual = page.getByRole('region', { name: 'Plan my year', exact: true })
  await annual.getByLabel('Available leave for included trips', { exact: true }).fill('18')
  await annual.getByLabel('Protected reserve', { exact: true }).fill('3')
  await annual.getByRole('button', { name: 'Generate plans', exact: true }).click()
  return page.getByRole('region', { name: 'Your annual plans', exact: true })
}

async function downloadAnnualCalendar(page: Page) {
  const delivery = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download annual calendar', exact: true }).click()
  const download = await delivery
  expect(download.suggestedFilename()).toBe('annual-vacations-2027.ics')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const text = await readFile(path!, 'utf8')
  const components = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent')
  return { text, components, events: components.map((component) => new ICAL.Event(component)) }
}

test('the selected annual plan downloads all breaks with private budget and stable identities', async ({
  page,
}) => {
  const plans = await openAnnualPlanner(
    page,
    annualRunSchema.parse(annualFixtureWithAlternatives()),
  )
  await plans.getByRole('button', { name: 'View Fewer leave days', exact: true }).click()
  const first = await downloadAnnualCalendar(page)
  expect(
    first.events.map((event) => [event.startDate.toString(), event.endDate.toString()]),
  ).toEqual([
    ['2027-03-05', '2027-03-09'],
    ['2027-05-07', '2027-05-11'],
    ['2027-08-13', '2027-08-22'],
  ])
  expect(new Set(first.events.map((event) => event.uid)).size).toBe(3)
  for (const component of first.components) {
    const event = new ICAL.Event(component)
    expect(event.startDate.isDate).toBe(true)
    expect(event.endDate.isDate).toBe(true)
    expect(event.description).toContain('Total vacation days required: 8')
    expect(event.description).not.toMatch(/Available:|remaining:|protected reserve:/)
    expect(component.getFirstPropertyValue('status')).toBe('TENTATIVE')
    expect(component.getFirstPropertyValue('transp')).toBe('TRANSPARENT')
    expect(component.getAllProperties('attendee')).toEqual([])
  }
  expect(first.text).not.toContain('annual-browser-test-token')

  await plans.getByLabel('Include budget and reserve', { exact: true }).check()
  const withBudget = await downloadAnnualCalendar(page)
  expect(withBudget.events.map((event) => event.uid)).toEqual(
    first.events.map((event) => event.uid),
  )
  expect(withBudget.events[0].description).toContain(
    'Available: 18; used: 8; remaining: 10; protected reserve: 3; unallocated: 7.',
  )
})

test('a reduced annual download includes only retained breaks and discloses the omission', async ({
  page,
}) => {
  const result = annualRunSchema.parse(annualFixture())
  const plan = result.plans[0]
  result.status = 'infeasible'
  result.full_mix_feasibility = 'infeasible'
  result.conflicts = [{ code: 'mix_constraints', slot_ids: ['long', 'short-1', 'short-2'] }]
  plan.fulfillment = 'reduced'
  plan.retained_slot_ids = ['short-1', 'short-2']
  plan.omitted_slot_ids = ['long']
  plan.breaks = plan.breaks.slice(0, 2)
  plan.accounting = {
    ...plan.accounting,
    total_leave_used: 3,
    remaining_days: 15,
    unallocated_days: 12,
    total_days_away: 8,
    charged_dates: ['2027-03-07', '2027-03-08', '2027-05-10'],
  }
  const plans = await openAnnualPlanner(page, result)
  await expect(
    plans.getByText('Reduced plan: 2 of 3 requested breaks', { exact: true }),
  ).toBeVisible()
  const downloaded = await downloadAnnualCalendar(page)
  expect(
    downloaded.events.map((event) => [event.startDate.toString(), event.endDate.toString()]),
  ).toEqual([
    ['2027-03-05', '2027-03-09'],
    ['2027-05-07', '2027-05-11'],
  ])
  for (const event of downloaded.events) {
    expect(event.description).toContain('Reduced plan: 2 of 3 requested breaks')
    expect(event.description).toContain('Not included: Break 1 (7–14 days)')
    expect(event.description).toContain('Total vacation days required: 3')
    expect(event.description).not.toMatch(/Available:|remaining:|protected reserve:/)
  }
})
