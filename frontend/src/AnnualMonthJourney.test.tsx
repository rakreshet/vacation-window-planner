import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function openPlanner() {
  const requests: Array<{ url: string; body: unknown }> = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
    return {
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : annualFixture()),
    }
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  return {
    months: within(screen.getByRole('group', { name: 'Start months for new breaks' })),
    fetch,
    requests,
  }
}

test('clear all lets a user choose May alone without calculating until explicit generation', async () => {
  const { months, fetch, requests } = openPlanner()
  expect(months.getAllByRole('checkbox', { checked: true })).toHaveLength(12)
  const clear = months.getByRole('button', { name: 'Clear all months' })
  clear.focus()
  fireEvent.click(clear)
  expect(months.getAllByRole('checkbox', { checked: false })).toHaveLength(12)
  expect(clear).toHaveFocus()
  expect(months.getByText('No months selected')).toBeVisible()
  fireEvent.click(months.getByRole('checkbox', { name: 'May' }))
  expect(months.getAllByRole('checkbox', { checked: true })).toHaveLength(1)
  expect(months.getByRole('checkbox', { name: 'May' })).toBeChecked()
  expect(months.getByText('1 month selected')).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByRole('region', { name: 'Your annual plans' })
  expect(requests.find(({ url }) => url.endsWith('/annual-plans'))?.body).toMatchObject({
    allowed_start_months: [5],
  })
})

test('select all restores every month and repeating it leaves a current plan usable', async () => {
  const { months, fetch, requests } = openPlanner()
  fireEvent.click(months.getByRole('button', { name: 'Clear all months' }))
  fireEvent.click(months.getByRole('checkbox', { name: 'May' }))
  fireEvent.click(months.getByRole('checkbox', { name: 'July' }))
  const select = months.getByRole('button', { name: 'Select all months' })
  select.focus()
  fireEvent.click(select)
  expect(months.getAllByRole('checkbox', { checked: true })).toHaveLength(12)
  expect(months.getByText('12 months selected')).toBeVisible()
  expect(select).toHaveFocus()
  expect(fetch).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const result = within(await screen.findByRole('region', { name: 'Your annual plans' }))
  expect(requests.find(({ url }) => url.endsWith('/annual-plans'))?.body).toMatchObject({
    allowed_start_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  })
  const calls = fetch.mock.calls.length
  fireEvent.click(select)
  for (const button of result.getAllByRole('button', { name: 'Find flights' }))
    expect(button).toBeEnabled()
  expect(fetch).toHaveBeenCalledTimes(calls)
})

test('clearing months invalidates a current flight panel and keeps empty-selection validation local', async () => {
  const { months, fetch } = openPlanner()
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const result = within(await screen.findByRole('region', { name: 'Your annual plans' }))
  fireEvent.click(result.getAllByRole('button', { name: 'Find flights' })[0])
  expect(result.getByRole('button', { name: 'Close flight panel' })).toBeVisible()
  const calls = fetch.mock.calls.length
  fireEvent.click(months.getByRole('button', { name: 'Clear all months' }))
  expect(result.queryByRole('button', { name: 'Close flight panel' })).not.toBeInTheDocument()
  expect(result.getByText('Last calculation — inputs have changed')).toBeVisible()
  for (const button of result.getAllByRole('button', { name: 'Find flights' }))
    expect(button).toBeDisabled()
  expect(fetch).toHaveBeenCalledTimes(calls)

  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('start months')
  expect(screen.getByRole('group', { name: 'Start months for new breaks' })).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(calls)
  fireEvent.click(months.getByRole('button', { name: 'Select all months' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
