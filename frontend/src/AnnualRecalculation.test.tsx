import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
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

test('locking a calculated break only edits the draft until explicit recalculation', async () => {
  const submitted: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/sessions')) return { ok: true, json: async () => ({ token: 'token' }) }
      const input = JSON.parse(String(init?.body))
      submitted.push(input)
      const result = annualFixture()
      result.input = input
      result.run_id = `00000000-0000-4000-8000-${String(submitted.length).padStart(12, '0')}`
      if (submitted.length > 1) {
        result.plans[0].breaks[0].locked = true
      }
      return { ok: true, json: async () => result }
    }),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const result = within(await screen.findByRole('region', { name: 'Your annual plans' }))
  fireEvent.click(result.getByRole('button', { name: 'Lock Break 2 dates' }))
  expect(submitted).toHaveLength(1)
  expect(screen.getByText('Last calculation — inputs have changed')).toBeInTheDocument()
  expect(screen.getByText('Locked: 2027-03-05 – 2027-03-08')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  await screen.findByText('Dates unchanged; leave cost unchanged')
  expect(submitted).toHaveLength(2)
  expect(submitted[1]).toMatchObject({
    slots: expect.arrayContaining([
      {
        slot_id: 'short-1',
        min_days: 3,
        max_days: 5,
        locked_dates: { start_date: '2027-03-05', end_date: '2027-03-08' },
      },
    ]),
  })
})

test('the year view has twelve months and keyboard-friendly links to break details', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : annualFixture()),
    })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const year = within(await screen.findByRole('region', { name: '2027 year view' }))
  expect(year.getAllByRole('heading', { level: 4 })).toHaveLength(12)
  expect(
    year.getByText('March: 2027-03-05 – 2027-03-08; unavailable dates: none; past dates: none.'),
  ).toBeInTheDocument()
  fireEvent.click(year.getByRole('button', { name: 'Show Break 2 details' }))
  expect(screen.getByRole('group', { name: 'Break 2 charged dates and day details' })).toHaveFocus()
})

test('whole-plan selection changes the year view and lock action together', async () => {
  const { annualFixtureWithAlternatives } = await import('./annualFixtures')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/sessions') ? { token: 'token' } : annualFixtureWithAlternatives(),
    })),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  const comparisons = within(await screen.findByRole('table', { name: 'Compare whole plans' }))
  fireEvent.click(comparisons.getByRole('button', { name: 'View Fewer leave days' }))
  expect(screen.getByRole('heading', { name: '2027-08-13 – 2027-08-21' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lock Break 1 dates' }))
  expect(screen.getByText('Locked: 2027-08-13 – 2027-08-21')).toBeInTheDocument()
})

test('editing during calculation ignores the late response and keeps the new draft', async () => {
  let finish: (() => void) | undefined
  const pending = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
    finish = () => resolve({ ok: true, json: async () => annualFixture() })
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/sessions') ? { ok: true, json: async () => ({ token: 'token' }) } : pending,
    ),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/annual-plans'), expect.anything()),
  )
  expect(screen.getByLabelText('Protected reserve')).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '4' } })
  await act(async () => {
    finish?.()
    await pending
  })
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(4)
  expect(screen.queryByRole('region', { name: 'Your annual plans' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate plans' })).toBeEnabled()
})

test('unlocking an exact short break requires a generated range and never calculates automatically', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  const slot = within(screen.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.change(slot.getByLabelText('Locked start date'), { target: { value: '2027-08-06' } })
  fireEvent.change(slot.getByLabelText('Locked end date'), { target: { value: '2027-08-07' } })
  fireEvent.click(slot.getByRole('button', { name: 'Keep these dates' }))
  fireEvent.click(slot.getByRole('button', { name: 'Convert to exact-date break' }))
  fireEvent.click(slot.getByRole('button', { name: 'Unlock dates' }))
  expect(slot.getByText('Locked: 2027-08-06 – 2027-08-07')).toBeInTheDocument()
  expect(slot.getByRole('alert')).toHaveTextContent(
    'Choose a generated range of 3 to 28 days before unlocking',
  )
  fireEvent.change(slot.getByLabelText('Minimum days away'), { target: { value: '3' } })
  fireEvent.change(slot.getByLabelText('Maximum days away'), { target: { value: '5' } })
  fireEvent.click(slot.getByRole('button', { name: 'Unlock dates' }))
  expect(slot.queryByText(/Locked:/)).not.toBeInTheDocument()
  expect(slot.getByLabelText('Minimum days away')).toHaveValue(3)
  expect(fetch).not.toHaveBeenCalled()
})

test('an unfinished recalculation preserves the previous plan with disabled lock actions', async () => {
  let calculations = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/sessions')) return { ok: true, json: async () => ({ token: 'token' }) }
      calculations += 1
      const body =
        calculations === 1
          ? annualFixture()
          : {
              ...annualFixture(),
              status: 'too_broad',
              full_mix_feasibility: 'unknown',
              plans: [],
              limit_reason: 'transition_limit',
            }
      return { ok: true, json: async () => body }
    }),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByText('8 vacation days used')
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  await screen.findByText(/We could not finish checking this request/)
  expect(screen.getByText('8 vacation days used')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lock Break 2 dates' })).toBeDisabled()
  expect(screen.getByLabelText('Protected reserve')).toHaveValue(4)
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '5' } })
  expect(screen.queryByText(/We could not finish checking this request/)).not.toBeInTheDocument()
})

test('calendar edits announce a changed leave cost even when all dates stay the same', async () => {
  let calculations = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/sessions')) return { ok: true, json: async () => ({ token: 'token' }) }
      const result = annualFixture()
      calculations += 1
      if (calculations > 1) {
        const plan = result.plans[0]
        const march = plan.breaks[0]
        march.window.vacation_days_used = 1
        march.charged_dates = ['2027-03-08']
        march.day_details = march.day_details.map((day) =>
          day.date === '2027-03-07' ? { ...day, charged: false, kind: 'personal_day_off' } : day,
        )
        plan.breaks.forEach((item) => {
          item.balance_after_break += 1
        })
        plan.accounting = {
          ...plan.accounting,
          total_leave_used: 7,
          remaining_days: 11,
          unallocated_days: 8,
          charged_dates: plan.accounting.charged_dates.filter((date) => date !== '2027-03-07'),
        }
      }
      return { ok: true, json: async () => result }
    }),
  )
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByText('8 vacation days used')
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  expect(await screen.findByText('Dates unchanged; 1 fewer leave days used')).toBeInTheDocument()
})
