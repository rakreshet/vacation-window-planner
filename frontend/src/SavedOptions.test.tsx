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
