import { webcrypto } from 'node:crypto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { createActionSnapshot } from './actionSnapshots'
import { window as vacationWindow, assessment, context } from './snapshotFixtures'
import { SavedOptionsStore } from './savedOptions'
import SavedOptions from './SavedOptionsView'

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('saved details work offline, rename is explicit, and removal can be undone', async () => {
  const store = new SavedOptionsStore(new MemoryOptionStorage())
  const snapshot = await createActionSnapshot('search', vacationWindow, assessment, context)
  store.save(snapshot)
  const check = vi.fn()
  render(<SavedOptions store={store} onCheck={check} />)
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
  fireEvent.change(screen.getByLabelText('Option name'), { target: { value: 'Winter' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  expect(screen.getByRole('heading', { name: 'Winter' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check these dates' }))
  expect(check).toHaveBeenCalledWith(expect.objectContaining({ capture_id: snapshot.capture_id }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(screen.getByText('No saved options yet.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Undo remove' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Winter' })).toBeInTheDocument())
})

test('another tab can add an option without resetting existing saved options', async () => {
  const store = new SavedOptionsStore(new MemoryOptionStorage())
  render(<SavedOptions store={store} onCheck={() => {}} />)
  expect(screen.getByText('No saved options yet.')).toBeInTheDocument()
  store.save(await createActionSnapshot('search', vacationWindow, assessment, context))
  fireEvent(window, new Event('storage'))
  expect(screen.getByRole('button', { name: 'Check these dates' })).toBeInTheDocument()
})

test('saved over-budget dates never claim to be within the negative allowance', async () => {
  const store = new SavedOptionsStore(new MemoryOptionStorage())
  const costlyWindow = { ...vacationWindow, vacation_days_used: 3 }
  const costly = {
    ...assessment,
    window: costlyWindow,
    remaining_balance: -3,
    eligible: false,
    charged_dates: ['2027-01-07', '2027-01-08', '2027-01-09'],
    day_details: assessment.day_details.map((day) => ({
      ...day,
      charged: true,
      kind: 'extra_working_day' as const,
    })),
    warnings: ['negative_balance' as const],
    eligibility_reasons: [{ code: 'over_budget' as const, required_days: 3, permitted_days: 0 }],
  }
  store.save(
    await createActionSnapshot('comparison_baseline', costlyWindow, costly, {
      ...context,
      planning: { ...context.planning, balance_days: 0 },
    }),
  )
  render(<SavedOptions store={store} onCheck={() => {}} />)
  expect(screen.queryByText(/within your allowed negative balance/)).not.toBeInTheDocument()
})

test('a failed rename retains editable text and Escape cancels it', async () => {
  const storage = new MemoryOptionStorage()
  const store = new SavedOptionsStore(storage)
  store.save(await createActionSnapshot('search', vacationWindow, assessment, context))
  render(<SavedOptions store={store} onCheck={() => {}} />)
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded')
  })
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
  fireEvent.change(screen.getByLabelText('Option name'), { target: { value: 'Keep my draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  expect(screen.getByLabelText('Option name')).toHaveValue('Keep my draft')
  fireEvent.keyDown(screen.getByLabelText('Option name'), { key: 'Escape' })
  expect(screen.queryByLabelText('Option name')).not.toBeInTheDocument()
})
