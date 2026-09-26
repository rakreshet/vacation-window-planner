import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T22:30:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('annual date pickers exclude elapsed dates in the planning zone and end dates before the start', () => {
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.change(screen.getByLabelText('Plan year'), { target: { value: '2026' } })
  const slot = within(screen.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  const start = slot.getByLabelText('Locked start date')
  const end = slot.getByLabelText('Locked end date')
  expect(start).toHaveAttribute('min', '2026-09-27')
  expect(start).toHaveAttribute('max', '2026-12-31')
  expect(end).toHaveAttribute('min', '2026-09-27')
  fireEvent.change(start, { target: { value: '2026-10-10' } })
  expect(end).toHaveAttribute('min', '2026-10-10')
  expect(end).toHaveAttribute('max', '2026-12-31')
})

test('typed past dates cannot be kept or converted into a locked trip', () => {
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.change(screen.getByLabelText('Plan year'), { target: { value: '2026' } })
  const slot = within(screen.getByRole('group', { name: 'Break 1' }))
  fireEvent.click(slot.getByRole('button', { name: 'Add exact dates' }))
  fireEvent.change(slot.getByLabelText('Locked start date'), { target: { value: '2026-09-26' } })
  fireEvent.change(slot.getByLabelText('Locked end date'), { target: { value: '2026-10-03' } })
  fireEvent.click(slot.getByRole('button', { name: 'Keep these dates' }))
  expect(slot.queryByText(/^Locked:/)).not.toBeInTheDocument()
  expect(slot.getByRole('alert')).toHaveTextContent('today or later')
  expect(slot.getByLabelText('Locked start date')).toHaveValue('2026-09-26')
})
