import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  const options = new Intl.DateTimeFormat().resolvedOptions()
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'Asia/Jerusalem',
  })
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('annual planning starts with an independent three-break mix and protected reserve', async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', database: 'connected' }),
  })
  vi.stubGlobal('fetch', fetch)
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '18' } })
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const workspace = within(screen.getByRole('region', { name: 'Plan my year' }))
  expect(workspace.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(workspace.getByLabelText('Protected reserve')).toHaveValue(0)
  expect(workspace.getAllByRole('group', { name: /Break \d/ })).toHaveLength(3)
  expect(workspace.queryByLabelText('Allowed negative days')).not.toBeInTheDocument()
  fireEvent.change(workspace.getByLabelText('Available leave for included trips'), {
    target: { value: '12' },
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  vi.stubGlobal('scrollTo', vi.fn())
  fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
  expect(screen.getByLabelText('Vacation balance')).toHaveValue(18)
})

test('explicit generation shows aggregate leave and chronological charged dates', async () => {
  const { annualFixture } = await import('./annualFixtures')
  const requests: Array<{ url: string; body: unknown }> = []
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
              ? { token: 'annual-token' }
              : annualFixture(),
      }
    }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const workspace = within(screen.getByRole('region', { name: 'Plan my year' }))
  fireEvent.change(workspace.getByLabelText('Available leave for included trips'), {
    target: { value: '18' },
  })
  fireEvent.change(workspace.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.click(workspace.getByRole('button', { name: 'Generate plans' }))
  const result = within(await workspace.findByRole('region', { name: 'Your annual plans' }))
  expect(result.getByText('8 vacation days used')).toBeInTheDocument()
  expect(result.getByText('10 days remain, including 3 protected')).toBeInTheDocument()
  expect(result.getByText('7 days unallocated')).toBeInTheDocument()
  expect(result.getByText('17 days away')).toBeInTheDocument()
  expect(requests.find((request) => request.url.endsWith('/sessions'))?.body).toMatchObject({
    balance_days: 18,
    allowed_negative_days: 0,
  })
  expect(requests.find((request) => request.url.endsWith('/annual-plans'))?.body).toMatchObject({
    reserve_days: 3,
    minimum_gap_days: 7,
  })
  expect(result.queryByRole('button', { name: /Save|Copy|Download/ })).not.toBeInTheDocument()
})

test('year, months, spacing and ordered slots are explicit draft edits', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) })
  vi.stubGlobal('fetch', fetch)
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const workspace = within(screen.getByRole('region', { name: 'Plan my year' }))
  fireEvent.change(workspace.getByLabelText('Plan year'), {
    target: { value: '2026' },
  })
  fireEvent.change(workspace.getByLabelText('Minimum dates between breaks'), {
    target: { value: '10' },
  })
  fireEvent.click(workspace.getByLabelText('January'))
  expect(workspace.getByLabelText('January')).not.toBeChecked()
  fireEvent.click(workspace.getByRole('button', { name: 'Add a break' }))
  expect(workspace.getAllByRole('group', { name: /Break \d/ })).toHaveLength(4)
  const first = within(workspace.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(first.getByRole('button', { name: 'Move down' }))
  expect(
    within(workspace.getByRole('group', { name: 'Break 2' })).getByLabelText('Minimum days away'),
  ).toHaveValue(7)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('manual dates fill their chosen slot and require explicit conversion when lengths differ', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const workspace = within(screen.getByRole('region', { name: 'Plan my year' }))
  const slot = within(workspace.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.change(slot.getByLabelText('Locked start date'), { target: { value: '2027-08-06' } })
  fireEvent.change(slot.getByLabelText('Locked end date'), { target: { value: '2027-08-07' } })
  fireEvent.click(slot.getByRole('button', { name: 'Keep these dates' }))
  expect(slot.getByRole('alert')).toHaveTextContent('Dates do not fit this break')
  fireEvent.click(slot.getByRole('button', { name: 'Convert to exact-date break' }))
  expect(slot.getByText('Locked: 2027-08-06 – 2027-08-07')).toBeInTheDocument()
  expect(slot.getByLabelText('Minimum days away')).toHaveValue(2)
  expect(slot.queryByRole('button', { name: 'Remove break' })).not.toBeInTheDocument()
  expect(workspace.getAllByRole('group', { name: /Break \d/ })).toHaveLength(3)
})

test('saved vacations supply dates only after explicit selection and keep their original calendar', async () => {
  const { webcrypto } = await import('node:crypto')
  const { createActionSnapshot } = await import('./actionSnapshots')
  const { window: vacation, assessment, context } = await import('./snapshotFixtures')
  const { SavedOptionsStore } = await import('./savedOptions')
  vi.stubGlobal('crypto', webcrypto)
  const { MemoryOptionStorage } = await import('./memoryOptionStorage')
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const store = new SavedOptionsStore(storage)
  const snapshot = await createActionSnapshot('search', vacation, assessment, context)
  store.save(snapshot)
  store.rename(snapshot.capture_id, 'Winter trip')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const slot = within(screen.getByRole('group', { name: 'Break 2' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.click(slot.getByRole('button', { name: 'Choose a saved vacation' }))
  expect(slot.getByLabelText('Locked start date')).toHaveValue('')
  fireEvent.change(slot.getByLabelText('Saved vacation'), {
    target: { value: snapshot.capture_id },
  })
  expect(
    slot.getByText('Previously calculated: 0 vacation days under its saved calendar'),
  ).toBeInTheDocument()
  fireEvent.click(slot.getByRole('button', { name: 'Keep these dates' }))
  expect(slot.getByText('Locked: 2027-01-07 – 2027-01-09')).toBeInTheDocument()
  expect(store.list().items[0].snapshot).toEqual(snapshot)
})

test('unfinished exact dates cannot be bypassed through another slot', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const first = within(screen.getByRole('group', { name: 'Break 1' }))
  const second = within(screen.getByRole('group', { name: 'Break 2' }))
  fireEvent.click(first.getByRole('button', { name: 'Add exact dates' }))
  expect(second.getByRole('button', { name: 'Add exact dates' })).toBeDisabled()
  fireEvent.click(first.getByRole('button', { name: 'Cancel dates' }))
  expect(second.getByRole('button', { name: 'Add exact dates' })).toBeEnabled()
})

test('removing the slot being edited releases the remaining date editors', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  const first = within(screen.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(first.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.click(first.getByRole('button', { name: 'Remove break' }))
  const remaining = within(screen.getByRole('group', { name: 'Break 1' }))
  expect(remaining.getByRole('button', { name: 'Add exact dates' })).toBeEnabled()
})
