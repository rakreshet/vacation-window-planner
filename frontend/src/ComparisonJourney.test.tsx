import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

export const comparison = {
  comparison_id: 'comparison-id',
  baseline: {
    window: {
      start_date: '2027-01-03',
      end_date: '2027-01-07',
      total_days: 5,
      vacation_days_used: 5,
      holiday_dates: [],
    },
    charged_dates: ['2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07'],
    weekend_dates: [],
    remaining_balance: 3,
    feasible: true,
    warnings: [],
  },
  save_leave: [],
  longer_break: [],
  policy: {
    version: 'phase05-v1',
    shift_days: 21,
    extra_days: 7,
    max_length_days: 28,
    result_limit: 3,
    generation_cap: 2000,
  },
  notices: [],
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test.each(['IL', 'US', 'GB'])(
  'manual dates use the selected %s calendar without a search',
  async (country) => {
    const requests: Array<{ url: string; body: unknown }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
        const data = url.endsWith('/health')
          ? { status: 'ok', database: 'connected' }
          : url.endsWith('/sessions')
            ? { token: 'token' }
            : comparison
        return { ok: true, json: async () => data }
      }),
    )
    render(<App />)
    await screen.findByText('Service ready')
    fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
    const workspace = within(
      screen.getByRole('region', { name: 'Could nearby dates work better?' }),
    )
    fireEvent.change(workspace.getByLabelText('Country calendar'), { target: { value: country } })
    fireEvent.change(workspace.getByLabelText('Vacation balance'), { target: { value: '8' } })
    fireEvent.change(workspace.getByLabelText('Start date'), { target: { value: '2027-01-03' } })
    fireEvent.change(workspace.getByLabelText('End date'), { target: { value: '2027-01-07' } })
    fireEvent.click(workspace.getByRole('button', { name: 'Compare dates' }))
    expect(await workspace.findByRole('region', { name: 'Your dates' })).toHaveTextContent(
      '5 vacation days used',
    )
    expect(requests.find((item) => item.url.endsWith('/sessions'))?.body).toMatchObject({
      country_code: country,
      weekend_days: country === 'IL' ? [4, 5] : [5, 6],
    })
    expect(requests.some((item) => item.url.endsWith('/recommendations'))).toBe(false)
    expect(requests.find((item) => item.url.endsWith('/comparisons'))?.body).toEqual({
      start_date: '2027-01-03',
      end_date: '2027-01-07',
    })
  },
)

test.each(['IL', 'US', 'GB'])(
  'a %s search retains its calendar in comparison and preserves feedback on return',
  async (country) => {
    const requests: Array<{ url: string; body: unknown }> = []
    const search = {
      search_id: 'search-id',
      recommendations: [
        {
          rank: 1,
          window: comparison.baseline.window,
          score: 72,
          explanation: 'A useful break.',
          remaining_balance: 3,
          warnings: [],
          matching_window_count: 2,
          alternative_windows: [
            { ...comparison.baseline.window, start_date: '2027-01-10', end_date: '2027-01-14' },
          ],
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
        const data = url.endsWith('/health')
          ? { status: 'ok', database: 'connected' }
          : url.endsWith('/sessions')
            ? { token: 'token' }
            : url.endsWith('/recommendations')
              ? search
              : url.endsWith('/feedback')
                ? { value: 'thumbs_up' }
                : comparison
        return { ok: true, json: async () => data }
      }),
    )
    render(<App />)
    await screen.findByText('Service ready')
    fireEvent.change(screen.getByLabelText('Country calendar'), { target: { value: country } })
    fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2027-01' } })
    fireEvent.change(screen.getByLabelText('Preferred length in days'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('Search complete')
    fireEvent.click(screen.getByRole('button', { name: 'Thumbs up recommendation 1' }))
    await screen.findByText('Feedback saved')
    fireEvent.click(screen.getByText('2 matching date options · same score and vacation-day cost'))
    const opener = screen.getByRole('button', { name: 'Compare Jan 10 – Jan 14, 2027' })
    opener.focus()
    fireEvent.click(opener)
    const workspace = within(
      screen.getByRole('region', { name: 'Could nearby dates work better?' }),
    )
    await workspace.findByRole('region', { name: 'Your dates' })
    expect(workspace.getByLabelText('Start date')).toHaveValue('2027-01-10')
    expect(workspace.getByLabelText('Country calendar')).toHaveValue(country)
    expect(requests.find((item) => item.url.endsWith('/sessions'))?.body).toMatchObject({
      country_code: country,
      weekend_days: country === 'IL' ? [4, 5] : [5, 6],
    })
    expect(requests.filter((item) => item.url.endsWith('/sessions'))).toHaveLength(1)
    expect(requests.find((item) => item.url.endsWith('/comparisons'))?.body).toEqual({
      start_date: '2027-01-10',
      end_date: '2027-01-14',
      source_search_id: 'search-id',
    })
    fireEvent.click(workspace.getByRole('button', { name: '← Back to my results' }))
    await waitFor(() => expect(opener).toHaveFocus())
    expect(window.scrollTo).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Thumbs up recommendation 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Selected month')).toHaveValue('2027-01')
    expect(requests.filter((item) => item.url.endsWith('/recommendations'))).toHaveLength(1)
  },
)
