import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { MemoryOptionStorage } from './memoryOptionStorage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(new MemoryOptionStorage() as Storage)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})
async function openApp() {
  const request = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) })
  vi.stubGlobal('fetch', request)
  render(<App />)
  await screen.findByText('Service ready')
  return request
}
test('appearance and quick lengths preserve independent drafts without submitting planning requests', async () => {
  const request = await openApp()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Vacation balance' }), {
    target: { value: '18' },
  })
  fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2027-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'A week' }))
  expect(screen.getByLabelText('Preferred length in days')).toHaveValue(7)
  expect(screen.getByRole('button', { name: 'A week' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByLabelText('Describe your ideal break'), {
    target: { value: 'An April break' },
  })
  fireEvent.click(screen.getByText('Appearance', { exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Ocean' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close appearance settings' }))
  expect(screen.getByText('Appearance', { exact: true })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-04-08' } })
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  fireEvent.change(screen.getByLabelText('Available leave for included trips'), {
    target: { value: '12' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
  expect(screen.getByRole('spinbutton', { name: 'Vacation balance' })).toHaveValue(18)
  expect(screen.getByLabelText('Selected month')).toHaveValue('2027-04')
  expect(screen.getByLabelText('Preferred length in days')).toHaveValue(7)
  expect(screen.getByLabelText('Describe your ideal break')).toHaveValue('An April break')
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2027-04-08')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(12)
  fireEvent.click(screen.getByText('Appearance', { exact: true }))
  expect(screen.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true')
  expect(request).toHaveBeenCalledTimes(1)
})
test('saved empty states return to the appropriate planner and retain current drafts', async () => {
  const request = await openApp()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Vacation balance' }), {
    target: { value: '14' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Explore vacation dates' }))
  expect(screen.getByRole('spinbutton', { name: 'Vacation balance' })).toHaveValue(14)
  fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Annual plans' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start planning my year' }))
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(14)
  expect(screen.getByRole('heading', { name: 'Plan my year' })).toHaveFocus()
  expect(request).toHaveBeenCalledTimes(1)
})
test('annual validation opens a collapsed personal calendar and focuses its invalid field', async () => {
  const request = await openApp()
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const annual = within(screen.getByRole('region', { name: 'Plan my year' }))
  fireEvent.change(annual.getByLabelText('Available leave for included trips'), {
    target: { value: '18' },
  })
  const notice = annual.getByLabelText('Minimum notice days')
  const disclosure = notice.closest('details')!
  fireEvent.click(within(disclosure).getByText('Personal calendar & exceptions', { exact: false }))
  fireEvent.change(notice, { target: { value: '91' } })
  fireEvent.click(within(disclosure).getByText('Personal calendar & exceptions', { exact: false }))
  expect(disclosure).not.toHaveAttribute('open')
  fireEvent.click(annual.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() => expect(notice).toHaveFocus())
  expect(disclosure).toHaveAttribute('open')
  expect(notice).toHaveAttribute('aria-invalid', 'true')
  expect(request).toHaveBeenCalledTimes(1)
  fireEvent.click(within(disclosure).getByText('Personal calendar & exceptions', { exact: false }))
  fireEvent.click(annual.getByRole('link', { name: 'Review affected field' }))
  expect(disclosure).toHaveAttribute('open')
  expect(notice).toHaveFocus()
})

test('personal calendar rules remain applied when the disclosure is collapsed and reopened', async () => {
  const request = await openApp()
  const summary = screen.getByText('Personal calendar & exceptions', { exact: false })
  const disclosure = summary.closest('details')!
  expect(disclosure).not.toHaveAttribute('open')
  fireEvent.click(summary)
  expect(disclosure).toHaveAttribute('open')
  fireEvent.change(screen.getByLabelText('Allowed negative days'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add calendar rule' }))
  fireEvent.change(screen.getByLabelText('Rule start date'), { target: { value: '2027-04-08' } })
  fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2027-04-08' } })
  expect(screen.getByRole('button', { name: 'Find my dates' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  fireEvent.click(summary)
  expect(disclosure).not.toHaveAttribute('open')
  expect(summary).toHaveTextContent('1 rules · 0 notice days · 3 extra leave days allowed')
  fireEvent.click(summary)
  expect(screen.getByRole('button', { name: 'Edit Personal day off 2027-04-08' })).toBeVisible()
  expect(screen.getByLabelText('Allowed negative days')).toHaveValue(3)
  expect(screen.getByRole('button', { name: 'Find my dates' })).toBeEnabled()
  expect(request).toHaveBeenCalledTimes(1)
})

test('quick lengths mark results stale and change the next explicit request while themes do neither', async () => {
  const requests: { url: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
      return {
        ok: true,
        json: async () =>
          url.endsWith('/health')
            ? { status: 'ok', database: 'connected' }
            : url.endsWith('/sessions')
              ? { token: 'test-token' }
              : {
                  search_id: 'preset-search',
                  recommendations: [
                    {
                      rank: 1,
                      window: {
                        start_date: '2027-04-08',
                        end_date: '2027-04-14',
                        total_days: 7,
                        vacation_days_used: 5,
                        holiday_dates: [],
                      },
                      score: 72,
                      explanation: 'A useful break.',
                      remaining_balance: 13,
                      warnings: [],
                    },
                  ],
                },
      }
    }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '18' } })
  fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2027-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'A week' }))
  fireEvent.click(screen.getByRole('button', { name: 'Find my dates' }))
  await screen.findByText('Search complete')
  fireEvent.click(screen.getByText('Appearance', { exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Rose' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close appearance settings' }))
  expect(
    screen.getByRole('button', { name: 'Compare nearby dates for recommendation 1' }),
  ).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Two weeks' }))
  expect(
    screen.getByRole('button', { name: 'Compare nearby dates for recommendation 1' }),
  ).toBeDisabled()
  expect(requests.filter(({ url }) => url.endsWith('/recommendations'))).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Find my dates' }))
  await screen.findByText('Search complete')
  expect(
    requests.filter(({ url }) => url.endsWith('/recommendations')).map(({ body }) => body),
  ).toEqual([
    expect.objectContaining({ preferred_length_days: 7 }),
    expect.objectContaining({ preferred_length_days: 14 }),
  ])
})
