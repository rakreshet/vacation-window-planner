import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function openWorkspace(proposal: unknown) {
  const fetch = vi.fn<
    (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
  >(async () => ({
    ok: true,
    json: async () => proposal,
  }))
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  return fetch
}

test('interpretation reviews explicit zero and empty months, preserves omitted fields, and never calculates', async () => {
  const fetch = openWorkspace({
    reserve_days: 0,
    allowed_start_months: [],
    references: [],
    assumptions: [],
  })
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'No reserve and no start months' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  const proposal = within(await screen.findByRole('region', { name: 'Review annual proposal' }))
  expect(proposal.getByText('Protected reserve: 3 → 0')).toBeInTheDocument()
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(3)
  fireEvent.click(proposal.getByRole('button', { name: 'Apply proposal' }))
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(0)
  expect(screen.getByLabelText('January')).not.toBeChecked()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/annual-plans/interpret'),
    expect.objectContaining({
      body: JSON.stringify({
        text: 'No reserve and no start months',
        year: 2027,
        local_today: '2026-09-26',
      }),
    }),
  )
})

test('a proposed mix requires explicit mapping of an existing lock before applying', async () => {
  openWorkspace({
    year: 2028,
    available_days: 20,
    minimum_gap_days: 10,
    slots: [{ label: 'Long', min_days: 7, max_days: 14 }],
    references: [],
    assumptions: ['Long means 7–14 days'],
  })
  const slot = within(screen.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.change(slot.getByLabelText('Locked start date'), { target: { value: '2027-08-06' } })
  fireEvent.change(slot.getByLabelText('Locked end date'), { target: { value: '2027-08-14' } })
  fireEvent.click(slot.getByRole('button', { name: 'Keep these dates' }))
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'One long break in 2028, 20 days available and 10 dates between breaks' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  const review = within(await screen.findByRole('region', { name: 'Review annual proposal' }))
  expect(review.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  fireEvent.change(review.getByLabelText('Preserve locked Break 1 in'), { target: { value: '0' } })
  fireEvent.change(review.getByLabelText('Preserve locked Break 1 in'), { target: { value: '' } })
  expect(review.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  fireEvent.change(review.getByLabelText('Preserve locked Break 1 in'), { target: { value: '0' } })
  fireEvent.click(review.getByRole('button', { name: 'Apply proposal' }))
  expect(screen.getByText('Locked: 2027-08-06 – 2027-08-14')).toBeInTheDocument()
  expect(screen.getByLabelText('Plan year')).toHaveValue('2028')
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(20)
  expect(screen.getByLabelText('Minimum dates between breaks')).toHaveValue(10)
  expect(screen.getAllByRole('group', { name: /^Break \d$/ })).toHaveLength(1)
})

test('an unresolved saved trip requires explicit saved-date selection and slot assignment even with one match', async () => {
  const { SavedOptionsStore } = await import('./savedOptions')
  const { MemoryOptionStorage } = await import('./memoryOptionStorage')
  const { createActionSnapshot } = await import('./actionSnapshots')
  const { window: vacation, assessment, context } = await import('./snapshotFixtures')
  const { webcrypto } = await import('node:crypto')
  vi.stubGlobal('crypto', webcrypto)
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const saved = await createActionSnapshot('search', vacation, assessment, context)
  new SavedOptionsStore(storage).save(saved)
  const fetch = openWorkspace({ references: [{ description: 'my winter trip' }], assumptions: [] })
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'Keep my winter trip' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  const review = within(await screen.findByRole('region', { name: 'Review annual proposal' }))
  expect(review.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  fireEvent.change(review.getByLabelText('Saved trip for my winter trip'), {
    target: { value: saved.capture_id },
  })
  expect(review.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  fireEvent.change(review.getByLabelText('Slot for my winter trip'), { target: { value: '1' } })
  fireEvent.click(review.getByRole('button', { name: 'Apply proposal' }))
  expect(
    within(screen.getByRole('group', { name: 'Break 2' })).getByText(
      'Locked: 2027-01-07 – 2027-01-09',
    ),
  ).toBeInTheDocument()
  expect(new SavedOptionsStore(storage).list().items[0].snapshot).toEqual(saved)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).not.toHaveProperty('saved')
})

test('editing the draft while interpretation is pending leaves the proposal outdated', async () => {
  let resolve: ((value: unknown) => void) | undefined
  const response = new Promise((finish) => {
    resolve = finish
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => response })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'Reserve three days' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '5' } })
  resolve?.({ reserve_days: 3, references: [], assumptions: [] })
  await screen.findByText(
    'This proposal is outdated. Interpret again to review your current draft.',
  )
  expect(screen.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(5)
  fireEvent.click(screen.getByRole('button', { name: 'Discard proposal' }))
  expect(screen.queryByRole('region', { name: 'Review annual proposal' })).not.toBeInTheDocument()
})

test('provider failure leaves structured planning usable and reports no applied changes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'Three trips' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Annual interpretation is unavailable')
  expect(screen.getByRole('button', { name: 'Generate plans' })).toBeEnabled()
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
})

test('an unfinished date edit cannot be discarded by applying a replacement mix', async () => {
  openWorkspace({
    slots: [{ label: 'Long', min_days: 7, max_days: 14 }],
    references: [],
    assumptions: [],
  })
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Break 1' })).getByRole('button', {
      name: 'Add exact dates',
    }),
  )
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'One long trip' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  await screen.findByRole('region', { name: 'Review annual proposal' })
  expect(screen.getByRole('button', { name: 'Apply proposal' })).toBeDisabled()
  expect(
    screen.getByText('Keep or cancel your unfinished exact dates before applying a proposal.'),
  ).toBeInTheDocument()
})

test('reference dates use the proposed year and reject past manual selections before applying', async () => {
  openWorkspace({ year: 2026, references: [{ description: 'my trip' }], assumptions: [] })
  fireEvent.change(screen.getByLabelText('Describe your year'), {
    target: { value: 'Keep my trip this year' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Interpret annual request' }))
  const review = within(await screen.findByRole('region', { name: 'Review annual proposal' }))
  expect(review.getByLabelText('Start date for my trip')).toHaveAttribute('min', '2026-09-26')
  expect(review.getByLabelText('Start date for my trip')).toHaveAttribute('max', '2026-12-31')
  fireEvent.change(review.getByLabelText('Start date for my trip'), {
    target: { value: '2026-09-01' },
  })
  fireEvent.change(review.getByLabelText('End date for my trip'), {
    target: { value: '2026-09-07' },
  })
  fireEvent.change(review.getByLabelText('Slot for my trip'), { target: { value: '0' } })
  fireEvent.click(review.getByRole('button', { name: 'Apply proposal' }))
  expect(screen.queryByText(/^Locked:/)).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('today or later')
})
