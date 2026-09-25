import { cleanup, render, screen } from '@testing-library/react'
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
