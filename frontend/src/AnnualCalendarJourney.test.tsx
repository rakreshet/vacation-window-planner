import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
import { emptyPlanning } from './planning'
import { sixBreakCardFixture } from './yearCardFixtures'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function generate(body: unknown = annualFixture()) {
  const fetch = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.endsWith('/sessions') ? { token: 'token' } : body),
  }))
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  return { result: within(await screen.findByRole('region', { name: 'Your annual plans' })), fetch }
}

test('the full year calendar starts collapsed and toggles without recalculating or moving focus', async () => {
  const { result, fetch } = await generate()
  expect(result.queryByRole('region', { name: '2027 year view' })).not.toBeInTheDocument()
  expect(result.getAllByRole('button', { name: 'Find flights' })).toHaveLength(3)
  expect(result.getByRole('button', { name: 'Lock Break 2 dates' })).toBeEnabled()
  const firstBreak = result.getByRole('heading', { name: '2027-03-05 – 2027-03-08' })
  expect(
    firstBreak.compareDocumentPosition(result.getByRole('button', { name: 'Preview year card' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  const toggle = result.getByRole('button', { name: 'Show full year calendar' })
  const calls = fetch.mock.calls.length
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  toggle.focus()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(toggle).toHaveFocus()
  const calendar = result.getByRole('region', { name: '2027 year view' })
  expect(within(calendar).getAllByRole('heading', { level: 4 })).toHaveLength(12)
  fireEvent.click(result.getByRole('button', { name: 'Hide full year calendar' }))
  expect(result.queryByRole('region', { name: '2027 year view' })).not.toBeInTheDocument()
  expect(toggle).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(calls)
})

test('the compact overview retains every month and shows the selected breaks without opening the calendar', async () => {
  const { result } = await generate()
  const overview = within(result.getByRole('region', { name: '2027 year overview' }))
  expect(overview.getAllByRole('listitem')).toHaveLength(12)
  for (const month of [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ])
    expect(overview.getByRole('listitem', { name: month })).toBeVisible()
  const march = within(overview.getByRole('listitem', { name: 'March' }))
  expect(march.getByText('Break 2')).toBeVisible()
  expect(march.getByText('5–8')).toBeVisible()
  const may = within(overview.getByRole('listitem', { name: 'May' }))
  expect(may.getByText('Break 3')).toBeVisible()
  expect(may.getByText('7–10')).toBeVisible()
  expect(
    within(overview.getByRole('listitem', { name: 'January' })).getByText('No breaks'),
  ).toBeVisible()
  expect(result.queryByRole('region', { name: '2027 year view' })).not.toBeInTheDocument()
})

test('a locked leap-year break spans both compact months while omitted breaks stay absent', async () => {
  const { result } = await generate(sixBreakCardFixture(true))
  const overview = within(result.getByRole('region', { name: '2028 year overview' }))
  const february = within(overview.getByRole('listitem', { name: 'February' }))
  const march = within(overview.getByRole('listitem', { name: 'March' }))
  expect(february.getByText('26–29')).toBeVisible()
  expect(march.getByText('1–2')).toBeVisible()
  expect(february.getByText('Locked')).toBeVisible()
  expect(march.getByText('Locked')).toBeVisible()
  expect(february.getByText('2028-02-26 through 2028-03-02, inclusive.')).toBeInTheDocument()
  expect(
    within(overview.getByRole('listitem', { name: 'October' })).getByText('No breaks'),
  ).toBeVisible()
  expect(
    within(overview.getByRole('listitem', { name: 'December' })).getByText('No breaks'),
  ).toBeVisible()
  fireEvent.click(result.getByRole('button', { name: 'Show full year calendar' }))
  const calendar = within(result.getByRole('region', { name: '2028 year view' }))
  expect(
    calendar.getByText(
      'February: 2028-02-26 – 2028-03-02 (locked); unavailable dates: none; past dates: none.',
    ),
  ).toBeInTheDocument()
  fireEvent.click(calendar.getByRole('button', { name: 'Show Break 1 details' }))
  const details = result.getByRole('group', { name: 'Break 1 charged dates and day details' })
  expect(details).toHaveFocus()
  expect(within(details).getByText('2028-02-29: ordinary working, charged')).toBeVisible()
})
