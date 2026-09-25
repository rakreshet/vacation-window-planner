import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('shows that the service is ready when the health endpoint responds', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', database: 'connected' }),
    }),
  )

  render(<App />)

  expect(await screen.findByText('Service ready')).toBeInTheDocument()
})

test('uses the configured API base path for the health view', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '/custom-api')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== '/custom-api/health') throw new Error('wrong API path')
      return {
        ok: true,
        json: async () => ({ status: 'ok', database: 'connected' }),
      }
    }),
  )

  render(<App />)

  expect(await screen.findByText('Service ready')).toBeInTheDocument()
})

test('shows a checking state while the health request is pending', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )

  render(<App />)

  expect(screen.getByRole('status')).toHaveTextContent('Checking service…')
})

test('shows a failure state when the health request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  render(<App />)

  expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
})

function fillRequiredSearchFields() {
  fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2027-01' } })
  fireEvent.change(screen.getByLabelText('Preferred length in days'), {
    target: { value: '7' },
  })
}

test('interpretation only fills editable proposal fields and never searches', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/health')) {
      return { ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }
    }
    if (url.endsWith('/interpret')) {
      return {
        ok: true,
        json: async () => ({
          source_text: 'I have 8 days for a week in January',
          balance_days: 8,
          allowed_negative_days: 1,
          country_code: 'IL',
          months: [{ year: 2027, month: 1 }],
          preferred_length_days: 7,
          weekend_days: [4, 5],
          missing_fields: [],
        }),
      }
    }
    throw new Error(`unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByText('Service ready')

  fireEvent.change(screen.getByLabelText('Describe your ideal break'), {
    target: { value: 'I have 8 days for a week in January' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret' }))

  expect(await screen.findByDisplayValue('8')).toBeInTheDocument()
  expect(screen.getByLabelText('Allowed negative days')).toHaveValue(1)
  expect(screen.getByLabelText('Selected month')).toHaveValue('2027-01')
  expect(screen.getByLabelText('Preferred length in days')).toHaveValue(7)
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/recommendations'))).toBe(false)
})

test('proposal remains editable and search only uses confirmed local fields', async () => {
  const requests: Array<{ url: string; body?: string }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/health')) {
        return { ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }
      }
      if (url.endsWith('/sessions')) {
        return { ok: true, json: async () => ({ token: 'session-token' }) }
      }
      if (url.endsWith('/recommendations')) {
        return { ok: true, json: async () => ({ search_id: 'search-id', recommendations: [] }) }
      }
      throw new Error(`unexpected request: ${url}`)
    }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fillRequiredSearchFields()
  fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  expect(await screen.findByText('Search complete')).toBeInTheDocument()
  const sessionRequest = requests.find((item) => item.url.endsWith('/sessions'))
  expect(JSON.parse(sessionRequest?.body ?? '{}')).toMatchObject({ balance_days: 6 })
  const searchRequest = requests.find((item) => item.url.endsWith('/recommendations'))
  expect(JSON.parse(searchRequest?.body ?? '{}')).toMatchObject({
    months: [{ year: 2027, month: 1 }],
    preferred_length_days: 7,
  })
})

test('structured search works without using interpretation', async () => {
  const requestedUrls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.endsWith('/health')) {
        return { ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }
      }
      if (url.endsWith('/sessions')) {
        return { ok: true, json: async () => ({ token: 'session-token' }) }
      }
      return { ok: true, json: async () => ({ search_id: 'search-id', recommendations: [] }) }
    }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fillRequiredSearchFields()
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  expect(await screen.findByText('Search complete')).toBeInTheDocument()
  expect(requestedUrls.some((url) => url.endsWith('/interpret'))).toBe(false)
})

test('required fields and allowance bounds are validated accessibly', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', database: 'connected' }),
    }),
  )
  render(<App />)
  await screen.findByText('Service ready')

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Complete all required search fields')

  fillRequiredSearchFields()
  fireEvent.change(screen.getByLabelText('Allowed negative days'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Allowed negative days must be a whole number from 0 to 5',
    ),
  )
})
