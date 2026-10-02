import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  const request = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () =>
      String(input).endsWith('/interpret')
        ? {
            source_text: 'next April',
            balance_days: 10,
            allowed_negative_days: 5,
            country_code: 'IL',
            months: [{ year: 2025, month: 4 }],
            preferred_length_days: 12,
            weekend_days: [4, 5],
            missing_fields: [],
          }
        : { status: 'ok', database: 'connected' },
  }))
  vi.stubGlobal('fetch', request)
  render(<App />)
  return request
}

test('a past model proposal never fills the search month', async () => {
  setup()
  fireEvent.change(screen.getByLabelText('Describe your ideal break'), {
    target: { value: 'next April' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Fill in my details' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Fill in my details' })).toBeEnabled(),
  )
  expect(screen.getByLabelText('Selected month')).not.toHaveValue('2025-04')
  expect(screen.getByRole('alert')).toHaveTextContent(/past/i)
})

test('manual past months are rejected before creating a session', async () => {
  const request = setup()
  fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('Preferred length in days'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2025-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find my dates' }))
  expect(request.mock.calls.some(([url]) => String(url).endsWith('/sessions'))).toBe(false)
  expect(screen.getByRole('alert')).toHaveTextContent(/past/i)
  expect(screen.getByLabelText('Selected month')).toHaveAttribute('min', '2026-09')
})
