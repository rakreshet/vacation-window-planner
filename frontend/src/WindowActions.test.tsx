import { webcrypto } from 'node:crypto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import WindowActions from './WindowActions'
import { window as vacationWindow, assessment, context } from './snapshotFixtures'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { SavedOptionsStore } from './savedOptions'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('the selected exact dates save once and stale results cannot be saved', async () => {
  const store = new SavedOptionsStore(new MemoryOptionStorage())
  const props = { source: 'search' as const, window: vacationWindow, assessment, context, store }
  const view = render(<WindowActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save option' }))
  expect(await screen.findByText('Option saved')).toBeInTheDocument()
  expect(store.list().items[0].snapshot.window.start_date).toBe('2027-01-07')
  fireEvent.click(screen.getByRole('button', { name: 'Save option' }))
  expect(await screen.findByText('Already saved')).toBeInTheDocument()
  view.rerender(<WindowActions {...props} stale />)
  expect(screen.getByRole('button', { name: 'Save option' })).toBeDisabled()
})

test('denied clipboard shows selectable text and editing closes an open live preview', async () => {
  vi.stubGlobal('navigator', {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  })
  const props = { source: 'search' as const, window: vacationWindow, assessment, context }
  const view = render(<WindowActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy leave request' }))
  expect(await screen.findByLabelText('Leave request text')).toHaveTextContent('2027-01-07')
  fireEvent.click(screen.getByRole('button', { name: 'Copy text' }))
  expect(
    await screen.findByText('Clipboard unavailable. Select the text and copy it manually.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
  view.rerender(<WindowActions {...props} stale />)
  expect(screen.queryByLabelText('Leave request text')).not.toBeInTheDocument()
  view.rerender(<WindowActions {...props} />)
  expect(screen.queryByLabelText('Leave request text')).not.toBeInTheDocument()
})
