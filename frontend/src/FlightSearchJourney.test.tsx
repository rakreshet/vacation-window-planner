import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import RecommendationResults from './RecommendationResults'
import type { ComparisonResponse, RecommendationResponse } from './api'
import ComparisonResults from './ComparisonResults'
import App from './App'
import { context } from './snapshotFixtures'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixtureWithAlternatives } from './annualFixtures'
import { emptyPlanning } from './planning'
import SavedAnnualPlansView from './SavedAnnualPlansView'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { createAnnualSnapshot, SavedAnnualPlansStore } from './savedAnnualPlans'
import { annualRunSchema } from './annualContracts'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(new MemoryOptionStorage() as Storage)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const maySearch: RecommendationResponse = {
  search_id: 'may-search',
  recommendations: [
    {
      rank: 1,
      window: {
        start_date: '2027-05-01',
        end_date: '2027-05-10',
        total_days: 10,
        vacation_days_used: 5,
        holiday_dates: [],
      },
      score: 90,
      remaining_balance: 0,
      explanation: 'Ten days away using five leave days.',
      warnings: [],
    },
  ],
}

test('a vacation result hands off its inclusive dates with an ordinary Google Flights link and no requests', () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<RecommendationResults result={maySearch} />)
  fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
  const panel = within(screen.getByRole('region', { name: 'Find flights for this break' }))
  expect(panel.getByLabelText('Travel details')).toHaveValue(
    'Vacation break\nStart date: 2027-05-01\nEnd date: 2027-05-10\nDates include both start and end days.\nDeparture: Not entered\nDestination: Not entered',
  )
  expect(panel.getByLabelText('Departure city or airport (optional)')).toHaveValue('')
  expect(panel.getByLabelText('Destination (optional)')).toHaveValue('')
  expect(panel.getByText(/Enter the copied details on Google Flights/)).toBeInTheDocument()
  const link = panel.getByRole('link', { name: /Open Google Flights/ })
  expect(link).toHaveAttribute('href', 'https://www.google.com/travel/flights')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(fetch).not.toHaveBeenCalled()
})

test('manual locations stay optional, never use the calendar country, and copy the selected dates', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<RecommendationResults result={{ ...maySearch, calculation_context: context }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
  const panel = within(screen.getByRole('region', { name: 'Find flights for this break' }))
  expect(panel.getByLabelText('Departure city or airport (optional)')).toHaveValue('')
  fireEvent.change(panel.getByLabelText('Departure city or airport (optional)'), {
    target: { value: ' London Heathrow (LHR) ' },
  })
  fireEvent.change(panel.getByLabelText('Destination (optional)'), {
    target: { value: 'Lisbon' },
  })
  fireEvent.click(panel.getByRole('button', { name: 'Copy travel details' }))
  expect(await panel.findByRole('status')).toHaveTextContent('Travel details copied')
  expect(writeText).toHaveBeenCalledWith(
    'Vacation break\nStart date: 2027-05-01\nEnd date: 2027-05-10\nDates include both start and end days.\nDeparture: London Heathrow (LHR)\nDestination: Lisbon',
  )
})

test.each(['denied', 'unavailable'])(
  'clipboard %s leaves travel details visible and selected for manual copying',
  async (failure) => {
    vi.stubGlobal(
      'navigator',
      failure === 'denied'
        ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } }
        : {},
    )
    render(<RecommendationResults result={maySearch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    const panel = within(screen.getByRole('region', { name: 'Find flights for this break' }))
    fireEvent.click(panel.getByRole('button', { name: 'Copy travel details' }))
    expect(
      await panel.findByText(
        'Clipboard unavailable. Select the travel details and copy them manually.',
      ),
    ).toBeInTheDocument()
    const summary = panel.getByLabelText('Travel details') as HTMLTextAreaElement
    expect(summary).toHaveFocus()
    expect(summary.selectionStart).toBe(0)
    expect(summary.selectionEnd).toBe(summary.value.length)
    expect(summary.value).toContain('End date: 2027-05-10')
    expect(panel.getByRole('link', { name: /Open Google Flights/ })).toBeInTheDocument()
  },
)

test.each(['close', 'escape'])(
  '%s dismisses the focused panel and returns keyboard focus to its opener',
  (method) => {
    render(<RecommendationResults result={maySearch} />)
    const opener = screen.getByRole('button', { name: 'Find flights' })
    opener.focus()
    fireEvent.click(opener)
    const panel = screen.getByRole('region', { name: 'Find flights for this break' })
    expect(within(panel).getByRole('heading')).toHaveFocus()
    if (method === 'close')
      fireEvent.click(within(panel).getByRole('button', { name: 'Close flight panel' }))
    else
      fireEvent.keyDown(within(panel).getByLabelText('Destination (optional)'), { key: 'Escape' })
    expect(
      screen.queryByRole('region', { name: 'Find flights for this break' }),
    ).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(opener).toHaveAttribute('aria-expanded', 'false')
  },
)

test('editing inputs invalidates the current flight panel, explains its disabled action, and never resurrects it', () => {
  const view = render(<RecommendationResults result={maySearch} />)
  fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
  view.rerender(<RecommendationResults result={maySearch} stale />)
  expect(screen.getByRole('button', { name: 'Find flights' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Find flights' })).toHaveAccessibleDescription(
    'Search again to find flights for these dates.',
  )
  expect(screen.getByText('Search again to find flights for these dates.')).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
  view.rerender(<RecommendationResults result={maySearch} />)
  expect(screen.getByRole('button', { name: 'Find flights' })).toBeEnabled()
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
})

async function annualWorkspace() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () =>
        String(input).endsWith('/sessions')
          ? { token: 'annual-token' }
          : annualFixtureWithAlternatives(),
    })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByRole('region', { name: 'Your annual plans' })
}

test('each current annual break uses the selected plan and changing plans invalidates the earlier panel without requests', async () => {
  await annualWorkspace()
  expect(screen.getAllByRole('button', { name: 'Find flights' })).toHaveLength(3)
  fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[2])
  expect((screen.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2027-08-06\nEnd date: 2027-08-14',
  )
  const switcher = screen.getByRole('button', { name: 'View Fewer leave days' })
  switcher.focus()
  fireEvent.click(switcher)
  expect(switcher).toHaveFocus()
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[2])
  expect((screen.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2027-08-13\nEnd date: 2027-08-21',
  )
  expect(fetch).toHaveBeenCalledTimes(2)
})

test.each(['edit', 'pending'])(
  'an annual %s invalidates the handoff and visibly disables each break action',
  async (change) => {
    await annualWorkspace()
    fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[0])
    if (change === 'edit')
      fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '2' } })
    else {
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
      fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
      await screen.findByRole('button', { name: 'Calculating…' })
    }
    const reason =
      change === 'edit'
        ? 'Recalculate plans to find flights for these dates.'
        : 'Wait for the current calculation before finding flights.'
    for (const action of screen.getAllByRole('button', { name: 'Find flights' })) {
      expect(action).toBeDisabled()
      expect(action).toHaveAccessibleDescription(reason)
    }
    expect(screen.getAllByText(reason)[0]).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Find flights for this break' }),
    ).not.toBeInTheDocument()
  },
)

test('saved historical breaks open and copy offline with their saved context and unchanged snapshots', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const snapshot = await createAnnualSnapshot(
    annualRunSchema.parse(annualFixtureWithAlternatives()),
    'b'.repeat(64),
  )
  const store = new SavedAnnualPlansStore(storage)
  store.save(snapshot)
  store.rename(snapshot.capture_id, 'Saved summer')
  const before = storage.getItem(storage.key(0)!)
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<SavedAnnualPlansView />)
  fireEvent.click(await screen.findByRole('button', { name: 'Open annual plan' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[2])
  const panel = within(screen.getByRole('region', { name: 'Find flights for this break' }))
  expect(
    panel.getByText(
      'Historical annual calculation · Saved summer · Calculated Sep 26, 2026, 3:00 PM (Asia/Jerusalem)',
    ),
  ).toBeVisible()
  expect((panel.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2027-08-13\nEnd date: 2027-08-21',
  )
  fireEvent.click(panel.getByRole('button', { name: 'Copy travel details' }))
  await panel.findByText('Travel details copied')
  expect(writeText).toHaveBeenCalledWith(
    expect.stringContaining('Historical annual calculation · Saved summer'),
  )
  expect(storage.getItem(storage.key(0)!)).toBe(before)
  expect(fetch).not.toHaveBeenCalled()
})

test('choosing another break replaces the flight panel instead of leaving two selected breaks', () => {
  const second = {
    ...maySearch.recommendations[0],
    rank: 2,
    window: {
      ...maySearch.recommendations[0].window,
      start_date: '2027-06-02',
      end_date: '2027-06-11',
    },
  }
  render(
    <RecommendationResults
      result={{ ...maySearch, recommendations: [...maySearch.recommendations, second] }}
    />,
  )
  const actions = screen.getAllByRole('button', { name: 'Find flights' })
  fireEvent.click(actions[0])
  fireEvent.change(screen.getByLabelText('Destination (optional)'), { target: { value: 'Lisbon' } })
  fireEvent.click(actions[1])
  expect(screen.getAllByRole('region', { name: 'Find flights for this break' })).toHaveLength(1)
  expect((screen.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2027-06-02\nEnd date: 2027-06-11',
  )
  expect(actions[0]).toHaveAttribute('aria-expanded', 'false')
  expect(actions[1]).toHaveAttribute('aria-expanded', 'true')
})

test.each(['edit', 'close'])(
  'a late clipboard response cannot report success after a travel-detail %s',
  async (change) => {
    let finish: () => void = () => undefined
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockReturnValue(pending) } })
    render(<RecommendationResults result={maySearch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy travel details' }))
    if (change === 'edit')
      fireEvent.change(screen.getByLabelText('Destination (optional)'), {
        target: { value: 'Lisbon' },
      })
    else {
      fireEvent.click(screen.getByRole('button', { name: 'Close flight panel' }))
      fireEvent.click(screen.getByRole('button', { name: 'Find flights' }))
    }
    await act(async () => {
      finish()
      await pending
    })
    expect(screen.queryByText('Travel details copied')).not.toBeInTheDocument()
  },
)

test('alternate vacation dates hand off their own inclusive leap-day and cross-month break', () => {
  const result = {
    ...maySearch,
    recommendations: [
      {
        ...maySearch.recommendations[0],
        matching_window_count: 2,
        alternative_windows: [
          {
            start_date: '2028-02-26',
            end_date: '2028-03-02',
            total_days: 6,
            vacation_days_used: 4,
            holiday_dates: [],
          },
        ],
      },
    ],
  }
  render(<RecommendationResults result={result} />)
  fireEvent.click(screen.getByText('2 matching date options · same score and vacation-day cost'))
  expect(screen.getAllByRole('button', { name: 'Find flights' })).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[0])
  expect((screen.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2028-02-26\nEnd date: 2028-03-02',
  )
  expect(screen.getByText(/inclusive local dates/)).toHaveTextContent('2028')
})

test('a selected comparison hands off its own dates and stale comparisons disable flight actions', () => {
  const baseline = {
    window: maySearch.recommendations[0].window,
    charged_dates: [],
    weekend_dates: [],
    remaining_balance: 0,
    feasible: true,
    warnings: [],
  }
  const comparison: ComparisonResponse = {
    comparison_id: 'may-comparison',
    baseline,
    save_leave: [
      {
        evaluation: {
          ...baseline,
          window: {
            ...baseline.window,
            start_date: '2027-05-15',
            end_date: '2027-05-24',
            vacation_days_used: 4,
          },
        },
        delta: { extra_days: 0, vacation_days_saved: 1, start_shift_days: 14, end_shift_days: 14 },
        explanation: 'A later break uses one fewer leave day.',
      },
    ],
    longer_break: [],
    notices: [],
    policy: {
      version: 'phase05-v1',
      shift_days: 21,
      extra_days: 7,
      max_length_days: 28,
      result_limit: 3,
      generation_cap: 2000,
    },
  }
  const view = render(<ComparisonResults result={comparison} stale={false} />)
  fireEvent.click(screen.getByRole('button', { name: /Same 10 days off, 1 fewer vacation day/ }))
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Selected alternative' })).getByRole('button', {
      name: 'Find flights',
    }),
  )
  expect((screen.getByLabelText('Travel details') as HTMLTextAreaElement).value).toContain(
    'Start date: 2027-05-15\nEnd date: 2027-05-24',
  )
  view.rerender(<ComparisonResults result={comparison} stale />)
  expect(screen.getByRole('button', { name: 'Find flights' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Find flights' })).toHaveAccessibleDescription(
    'Update comparison to find flights for these dates.',
  )
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
})

test.each(['pending', 'navigation'])(
  'a search %s invalidates the flight panel while retaining the planning page',
  async (change) => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        json: async () =>
          String(input).endsWith('/health')
            ? { status: 'ok', database: 'connected' }
            : String(input).endsWith('/sessions')
              ? { token: 'token' }
              : maySearch,
      })),
    )
    render(<App />)
    await screen.findByText('Service ready')
    fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Selected month'), { target: { value: '2027-05' } })
    fireEvent.change(screen.getByLabelText('Preferred length in days'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find my dates' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Find flights' }))
    if (change === 'pending') {
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
      fireEvent.click(screen.getByRole('button', { name: 'Find my dates' }))
      expect(screen.getByRole('button', { name: 'Find flights' })).toBeDisabled()
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
      fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
      expect(screen.getByLabelText('Selected month')).toHaveValue('2027-05')
    }
    expect(
      screen.queryByRole('region', { name: 'Find flights for this break' }),
    ).not.toBeInTheDocument()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
    })
  },
)

test('switching saved snapshots invalidates the panel even when names, plan dates and calculation times match', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const firstRun = annualRunSchema.parse(annualFixtureWithAlternatives())
  const secondRun = structuredClone(firstRun)
  secondRun.input.minimum_gap_days = 8
  const store = new SavedAnnualPlansStore(storage)
  store.save(await createAnnualSnapshot(firstRun, 'a'.repeat(64)))
  store.save(await createAnnualSnapshot(secondRun, 'a'.repeat(64)))
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<SavedAnnualPlansView />)
  const openers = await screen.findAllByRole('button', { name: 'Open annual plan' })
  fireEvent.click(openers[0])
  fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[0])
  fireEvent.click(openers[1])
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['historical', 'recalculated'])(
  'leaving %s saved annual plans discards the flight panel while retaining the selected plan',
  async (stage) => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('crypto', webcrypto)
    const storage = new MemoryOptionStorage()
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
    new SavedAnnualPlansStore(storage).save(
      await createAnnualSnapshot(
        annualRunSchema.parse(annualFixtureWithAlternatives()),
        'a'.repeat(64),
      ),
    )
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<App />)
    await screen.findByText('Service unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annual plans' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open annual plan' }))
    if (stage === 'recalculated') {
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL) =>
          ({
            ok: true,
            json: async () =>
              String(input).endsWith('/sessions')
                ? { token: 'token' }
                : annualFixtureWithAlternatives(),
          }) as Response,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Recalculate this plan' }))
      fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
      await screen.findByRole('region', { name: 'Your annual plans' })
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'Find flights' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
    fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
    expect(
      screen.getByRole('region', {
        name: stage === 'historical' ? 'Saved annual calculation' : 'Your annual plans',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Find flights for this break' }),
    ).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(stage === 'historical' ? 1 : 3)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
    })
  },
)

test('leaving Compare discards the flight panel while retaining the compared dates', async () => {
  const response = {
    comparison_id: 'compared-may',
    baseline: {
      window: maySearch.recommendations[0].window,
      charged_dates: [],
      weekend_dates: [],
      remaining_balance: 0,
      feasible: true,
      warnings: [],
    },
    save_leave: [],
    longer_break: [],
    notices: [],
    policy: {
      version: 'phase05-v1',
      shift_days: 21,
      extra_days: 7,
      max_length_days: 28,
      result_limit: 3,
      generation_cap: 2000,
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () =>
        String(input).endsWith('/health')
          ? { status: 'ok', database: 'connected' }
          : String(input).endsWith('/sessions')
            ? { token: 'token' }
            : response,
    })),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  const workspace = within(screen.getByRole('region', { name: 'Could nearby dates work better?' }))
  fireEvent.change(workspace.getByLabelText('Vacation balance'), { target: { value: '5' } })
  fireEvent.change(workspace.getByLabelText('Start date'), { target: { value: '2027-05-01' } })
  fireEvent.change(workspace.getByLabelText('End date'), { target: { value: '2027-05-10' } })
  fireEvent.click(workspace.getByRole('button', { name: 'Compare dates' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Find flights' }))
  fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  expect(workspace.getByLabelText('End date')).toHaveValue('2027-05-10')
  expect(
    screen.queryByRole('region', { name: 'Find flights for this break' }),
  ).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(3)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1))
  })
})
