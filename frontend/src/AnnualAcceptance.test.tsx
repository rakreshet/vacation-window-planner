import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
})

test('invalid reserve retains the draft and links its error to the focused field', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  const reserve = screen.getByLabelText('Protected reserve')
  fireEvent.change(reserve, { target: { value: '19' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() => expect(reserve).toHaveFocus())
  expect(reserve).toHaveAttribute('aria-invalid', 'true')
  expect(reserve).toHaveValue(19)
  const summary = screen.getByRole('alert')
  fireEvent.click(within(summary).getByRole('link'))
  expect(reserve).toHaveFocus()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.change(reserve, { target: { value: '3' } })
  expect(reserve).not.toHaveAttribute('aria-invalid', 'true')
})

test('invalid break bounds and server lock errors link back to the retained break', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: url.endsWith('/sessions'),
      json: async () =>
        url.endsWith('/sessions')
          ? { token: 'token' }
          : {
              error: {
                message: 'Locked dates must be in the selected year',
                code: 'INVALID_ANNUAL_PLAN',
                fields: ['slots.0.locked_dates'],
              },
            },
    })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  const minimum = within(screen.getByRole('group', { name: 'Break 1' })).getByLabelText(
    'Minimum days away',
  )
  fireEvent.change(minimum, { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() => expect(minimum).toHaveFocus())
  expect(minimum).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(minimum, { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByText('Locked dates must be in the selected year')
  expect(screen.getByRole('group', { name: 'Break 1' })).toHaveFocus()
})

test('an empty leave balance receives focus before any request', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<AnnualPlanWorkspace initialPlanning={{ ...emptyPlanning, timeZone: 'Asia/Jerusalem' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Available leave for included trips')).toHaveFocus(),
  )
  expect(fetch).not.toHaveBeenCalled()
})

test('a lock conflict links to its break without removing it', async () => {
  const { annualFixture } = await import('./annualFixtures')
  const result = {
    ...annualFixture(),
    plans: [],
    status: 'conflict',
    full_mix_feasibility: 'not_evaluated',
    conflicts: [{ code: 'locked_overlap', slot_ids: ['long', 'short-1'] }],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : result),
    })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const plans = within(await screen.findByRole('region', { name: 'Your annual plans' }))
  fireEvent.click(plans.getByRole('link', { name: 'Edit Break 1' }))
  expect(screen.getByRole('group', { name: 'Break 1' })).toHaveFocus()
  expect(screen.getAllByRole('group', { name: /Break \d/ })).toHaveLength(3)
})

test('unfinished personal calendar edits return focus to their repair controls', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{
        ...emptyPlanning,
        balance: '18',
        timeZone: 'Asia/Jerusalem',
        calendarEditor: { start_date: '', end_date: '', kind: 'personal_day_off' },
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() => expect(screen.getByRole('group', { name: 'My calendar' })).toHaveFocus())
  expect(fetch).not.toHaveBeenCalled()
})
