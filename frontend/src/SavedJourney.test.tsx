import { webcrypto } from 'node:crypto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import { createActionSnapshot } from './actionSnapshots'
import { window as vacationWindow, assessment, context } from './snapshotFixtures'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { SavedOptionsStore } from './savedOptions'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('checking a saved option waits for submit, uses its timezone, and restores the previous Compare draft', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  new SavedOptionsStore(storage).save(
    await createActionSnapshot('search', vacationWindow, assessment, context),
  )
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-03-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
  const checkButton = await screen.findByRole('button', { name: 'Check these dates' })
  checkButton.focus()
  fireEvent.click(checkButton)
  const workspace = screen.getByRole('region', { name: 'Could nearby dates work better?' })
  expect(within(workspace).getByLabelText('Start date')).toHaveValue('2027-01-07')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '← Back to my results' }))
  await waitFor(() => expect(checkButton).toHaveFocus())
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  const restored = screen.getByRole('region', { name: 'Could nearby dates work better?' })
  expect(within(restored).getByLabelText('Start date')).toHaveValue('2027-03-01')
})

test('leaving the first saved check through Compare opens a normal editable workspace', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  new SavedOptionsStore(storage).save(
    await createActionSnapshot('search', vacationWindow, assessment, context),
  )
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', database: 'connected' }) }),
  )
  render(<App />)
  await screen.findByText('Service ready')
  fireEvent.click(screen.getByRole('button', { name: 'Saved options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check these dates' }))
  fireEvent.click(screen.getByRole('button', { name: 'Compare my dates' }))
  expect(
    screen.getByRole('region', { name: 'Could nearby dates work better?' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Compare dates' })).toBeEnabled()
})
