import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import ICAL from 'ical.js'
import { assessment, context, window as vacationWindow } from '../src/snapshotFixtures'

test('the vacation Download button delivers an importable all-day calendar file', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'))
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', database: 'connected' } }),
  )
  await page.route('**/api/sessions', (route) =>
    route.fulfill({ json: { token: 'browser-export-test-token' } }),
  )
  await page.route('**/api/recommendations', (route) =>
    route.fulfill({
      json: {
        search_id: 'browser-export-test',
        calculation_context: context,
        recommendations: [
          {
            window: vacationWindow,
            assessment,
            rank: 1,
            score: 90,
            remaining_balance: 8,
            explanation: 'Three days away without using leave.',
            warnings: [],
          },
        ],
      },
    }),
  )
  await page.goto('/')
  const search = page.getByRole('region', { name: 'Build your search' })
  await search.getByLabel('Vacation balance', { exact: true }).fill('8')
  await search.getByLabel('Selected month', { exact: true }).fill('2027-01')
  await search.getByLabel('Preferred length in days', { exact: true }).fill('3')
  await search.getByRole('button', { name: 'Find my dates', exact: true }).click()

  const delivery = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download calendar', exact: true }).click()
  const download = await delivery
  expect(download.suggestedFilename()).toBe('vacation-2027-01-07-2027-01-09.ics')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const text = await readFile(path!, 'utf8')
  const components = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent')
  expect(components).toHaveLength(1)
  const event = new ICAL.Event(components[0])
  expect(event.startDate.toString()).toBe('2027-01-07')
  expect(event.endDate.toString()).toBe('2027-01-10')
  expect(event.startDate.isDate).toBe(true)
  expect(event.endDate.isDate).toBe(true)
  expect(event.description).toContain('No vacation days are required')
  expect(components[0].getFirstPropertyValue('status')).toBe('TENTATIVE')
  expect(components[0].getFirstPropertyValue('transp')).toBe('TRANSPARENT')
  expect(components[0].getAllProperties('attendee')).toEqual([])
  expect(text).not.toContain('browser-export-test-token')
})
