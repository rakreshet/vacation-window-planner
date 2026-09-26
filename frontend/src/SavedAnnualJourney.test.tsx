import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import App from './App'
import { annualFixture } from './annualFixtures'
import { MemoryOptionStorage } from './memoryOptionStorage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...new Intl.DateTimeFormat().resolvedOptions(),
    timeZone: 'Asia/Jerusalem',
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('save and offline reopening preserve the original mix while recalculation uses a separate draft', async () => {
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const fetch = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/health')
        ? { status: 'ok', database: 'connected' }
        : url.endsWith('/sessions')
          ? { token: 'token' }
          : annualFixture(),
  }))
  vi.stubGlobal('fetch', fetch)
  render(<App />)
  await screen.findByText('Service ready')
  const navigation = within(screen.getByRole('navigation', { name: 'Planning task' }))
  fireEvent.click(navigation.getByRole('button', { name: 'Plan my year' }))
  const workspace = within(screen.getByRole('region', { name: 'Plan my year' }))
  fireEvent.change(workspace.getByLabelText('Available leave for included trips'), {
    target: { value: '18' },
  })
  fireEvent.change(workspace.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.click(workspace.getByRole('button', { name: 'Generate plans' }))
  await screen.findByText('8 vacation days used')
  fireEvent.click(workspace.getByRole('button', { name: 'Save this plan' }))
  await screen.findByText('Annual plan saved in this browser')
  fireEvent.change(workspace.getByLabelText('Protected reserve'), { target: { value: '5' } })
  expect(workspace.getByRole('button', { name: 'Save this plan' })).toBeDisabled()
  fireEvent.click(navigation.getByRole('button', { name: 'Saved options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Annual plans' }))
  const saved = within(screen.getByRole('region', { name: 'Saved annual plans' }))
  expect(saved.getByRole('heading', { name: '2027 annual plan' })).toBeInTheDocument()
  fetch.mockRejectedValue(new Error('offline'))
  const calls = fetch.mock.calls.length
  fireEvent.click(saved.getByRole('button', { name: 'Open annual plan' }))
  expect(screen.getByText(/Historical annual calculation/)).toBeInTheDocument()
  expect(screen.getByText('Calendar: IL · Asia/Jerusalem')).toBeInTheDocument()
  expect(
    within(screen.getByRole('region', { name: 'Saved annual calculation' })).getByText(
      '8 vacation days used',
    ),
  ).toBeInTheDocument()
  fireEvent.click(saved.getByRole('button', { name: 'Show Break 2 details' }))
  expect(saved.getByRole('group', { name: 'Break 2 charged dates and day details' })).toHaveFocus()
  fireEvent.click(saved.getByRole('button', { name: 'Recalculate this plan' }))
  const restored = within(screen.getByRole('region', { name: 'Plan my year' }))
  expect(restored.getByLabelText('Protected reserve')).toHaveValue(3)
  expect(restored.queryByText(/^Locked:/)).not.toBeInTheDocument()
  fireEvent.change(restored.getByLabelText('Protected reserve'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Back to saved annual plan' }))
  fireEvent.click(navigation.getByRole('button', { name: 'Plan my year' }))
  expect(workspace.getByLabelText('Protected reserve')).toHaveValue(5)
  expect(fetch.mock.calls.length).toBe(calls)
  expect(
    within(screen.getByRole('region', { name: 'Your annual plans' })).getByText(
      '8 vacation days used',
    ),
  ).toBeInTheDocument()
}, 10000)

test('saved annual rename, removal and undo survive reload and another-tab changes', async () => {
  const { createAnnualSnapshot, SavedAnnualPlansStore } = await import('./savedAnnualPlans')
  const { annualRunSchema } = await import('./annualContracts')
  const { default: SavedAnnualPlansView } = await import('./SavedAnnualPlansView')
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const run = annualRunSchema.parse(annualFixture())
  const snapshot = await createAnnualSnapshot(run, run.plans[0].plan_id)
  const store = new SavedAnnualPlansStore(storage)
  store.save(snapshot)
  storage.setItem('vacation-window:annual:v1:broken', '{')
  const view = render(<SavedAnnualPlansView />)
  fireEvent.click(screen.getByRole('button', { name: 'Rename annual plan' }))
  fireEvent.change(screen.getByLabelText('Annual plan name'), { target: { value: 'My holidays' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save annual name' }))
  expect(screen.getByRole('heading', { name: 'My holidays' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove annual plan' }))
  expect(screen.queryByRole('heading', { name: 'My holidays' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Undo annual removal' }))
  view.unmount()
  render(<SavedAnnualPlansView />)
  expect(screen.getByRole('heading', { name: 'My holidays' })).toBeInTheDocument()
  store.rename(snapshot.capture_id, 'Renamed elsewhere')
  fireEvent(window, new Event('storage'))
  expect(screen.getByRole('heading', { name: 'Renamed elsewhere' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable annual plan' }))
  expect(store.list().invalid).toHaveLength(0)
  expect(store.list().items).toHaveLength(1)
})

test('reopening a historical year keeps that year visible until explicitly repaired', async () => {
  const { createAnnualSnapshot, SavedAnnualPlansStore } = await import('./savedAnnualPlans')
  const { annualRunSchema } = await import('./annualContracts')
  const { default: SavedAnnualPlansView } = await import('./SavedAnnualPlansView')
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const run = annualRunSchema.parse(annualFixture())
  new SavedAnnualPlansStore(storage).save(await createAnnualSnapshot(run, run.plans[0].plan_id))
  vi.setSystemTime(new Date('2029-01-01T12:00:00Z'))
  render(<SavedAnnualPlansView />)
  fireEvent.click(screen.getByRole('button', { name: 'Open annual plan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate this plan' }))
  expect(screen.getByLabelText('Plan year')).toHaveValue('2027')
  expect(screen.getByRole('option', { name: '2027 — choose a supported year' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Plan year'), { target: { value: '2029' } })
  expect(screen.getByLabelText('Plan year')).toHaveValue('2029')
})
