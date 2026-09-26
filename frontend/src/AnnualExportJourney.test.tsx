import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  const text = screen.getByRole('textbox', { name: 'Annual leave request text' })
  expect(text).toHaveFocus()
  expect((text as HTMLTextAreaElement).value).not.toContain('protected reserve')
  expect(screen.getByLabelText('Include budget and reserve')).not.toBeChecked()
  fireEvent.click(screen.getByLabelText('Include budget and reserve'))
  expect((text as HTMLTextAreaElement).value).toContain('protected reserve: 3')
  fireEvent.click(screen.getByRole('button', { name: 'Copy annual text' }))
  await screen.findByText('Clipboard unavailable. Select the text and copy it manually.')
  expect(text).toHaveFocus()
  expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '4' } })
  expect(
    screen.queryByRole('textbox', { name: 'Annual leave request text' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Download annual calendar' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate plans' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Download annual calendar' })).toBeEnabled(),
  )
  expect(
    screen.queryByRole('textbox', { name: 'Annual leave request text' }),
  ).not.toBeInTheDocument()
})

test('a failed save leaves direct annual download available with one calendar file', async () => {
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
  const createUrl = vi.fn(() => 'blob:annual-calendar')
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }),
  )
  const downloads: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
  render(
    <AnnualPlanWorkspace
      initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Download annual calendar' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save this plan' }))
  await screen.findByText('Storage blocked')
  fireEvent.click(screen.getByRole('button', { name: 'Download annual calendar' }))
  expect(downloads).toEqual(['annual-vacations-2027.ics'])
  expect(createUrl).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Annual plan saved in this browser')).not.toBeInTheDocument()
})
