import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixture } from './annualFixtures'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openAnnualPreview() {
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
  const opener = await screen.findByRole('button', { name: 'Copy annual leave request' })
  await waitFor(() => expect(opener).toBeEnabled())
  fireEvent.click(opener)
  return opener
}

test('the annual leave preview dismisses with an icon and returns focus to its opener', async () => {
  const opener = await openAnnualPreview()
  expect(screen.getByRole('textbox', { name: 'Annual leave request text' })).toHaveFocus()
  const close = screen.getByRole('button', { name: 'Close annual preview' })
  expect(close).not.toHaveTextContent('Close annual preview')
  fireEvent.click(close)
  expect(
    screen.queryByRole('region', { name: 'Annual leave request preview' }),
  ).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('Escape closes the annual leave preview and returns focus to its opener', async () => {
  const opener = await openAnnualPreview()
  const text = screen.getByRole('textbox', { name: 'Annual leave request text' })
  expect(text).toHaveFocus()
  fireEvent.keyDown(text, { key: 'Escape' })
  expect(
    screen.queryByRole('region', { name: 'Annual leave request preview' }),
  ).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('annual copy preview defaults to private budget, survives clipboard denial, and closes on edits', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : annualFixture()),
    })),
  )
  const copy = vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copy annual leave request' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual leave request' }))
  let text = screen.getByRole('textbox', { name: 'Annual leave request text' })
  expect(text).toHaveFocus()
  expect((text as HTMLTextAreaElement).value).not.toContain('protected reserve')
  expect(screen.getByLabelText('Include budget and reserve')).not.toBeChecked()
  fireEvent.click(screen.getByLabelText('Include budget and reserve'))
  text = screen.getByRole('textbox', { name: 'Annual leave request text' })
  expect((text as HTMLTextAreaElement).value).toContain('protected reserve: 3')
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual text' }))
  await screen.findByText('Clipboard unavailable. Select the text and copy it manually.')
  expect(text).toHaveFocus()
  expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '4' } })
  expect(
    screen.queryByRole('textbox', { name: 'Annual leave request text' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy annual leave request' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copy annual leave request' })).toBeEnabled(),
  )
  expect(
    screen.queryByRole('textbox', { name: 'Annual leave request text' }),
  ).not.toBeInTheDocument()
})

test('a failed save leaves the annual leave-request preview available', async () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('Storage blocked')
  })
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
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copy annual leave request' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save this plan' }))
  await screen.findByText('Storage blocked')
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual leave request' }))
  expect(screen.getByLabelText('Annual leave request text')).toHaveTextContent(
    'Total vacation days required: 8',
  )
  expect(screen.queryByText('Annual plan saved in this browser')).not.toBeInTheDocument()
})

test('changing budget privacy invalidates completed and pending clipboard confirmations', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/sessions') ? { token: 'token' } : annualFixture()),
    })),
  )
  let finishCopy: () => void = () => undefined
  const copy = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve
        }),
    )
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copy annual leave request' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual leave request' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual text' }))
  await screen.findByText('Copied to clipboard')
  fireEvent.click(screen.getByLabelText('Include budget and reserve'))
  expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual text' }))
  fireEvent.click(screen.getByLabelText('Include budget and reserve'))
  await act(async () => finishCopy())
  expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
})
