import { webcrypto } from 'node:crypto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import AnnualPlanResults from './AnnualPlanResults'
import { sixBreakCardFixture } from './yearCardFixtures'
import { MemoryOptionStorage } from './memoryOptionStorage'
import { annualRunSchema } from './annualContracts'
import { createAnnualSnapshot, SavedAnnualPlansStore } from './savedAnnualPlans'
import SavedAnnualPlansView from './SavedAnnualPlansView'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import { annualFixtureWithAlternatives } from './annualFixtures'
import { emptyPlanning } from './planning'

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function workspace(app = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () =>
        String(input).endsWith('/sessions') ? { token: 'token' } : annualFixtureWithAlternatives(),
    })),
  )
  if (app) {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Vacation balance'), { target: { value: '18' } })
    fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
  } else
    render(
      <AnnualPlanWorkspace
        initialPlanning={{ ...emptyPlanning, balance: '18', timeZone: 'Asia/Jerusalem' }}
      />,
    )
  fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate plans' }))
  await screen.findByRole('region', { name: 'Your annual plans' })
}
async function openPreview() {
  const opener = screen.getByRole('button', { name: 'Preview year card' })
  await waitFor(() => expect(opener).toBeEnabled())
  fireEvent.click(opener)
  return within(await screen.findByRole('region', { name: 'Year card preview' }))
}
function previewSvg() {
  const src = screen.getByRole('img', { name: 'Year card image' }).getAttribute('src')!
  return new DOMParser().parseFromString(
    decodeURIComponent(src.slice(src.indexOf(',') + 1)),
    'image/svg+xml',
  )
}

test('the selected annual plan has a private image preview and readable text equivalent', async () => {
  await workspace()
  fireEvent.click(screen.getByRole('button', { name: 'View Fewer leave days' }))
  const preview = await openPreview()
  expect(preview.getByText('17 days away · 3 breaks')).toBeInTheDocument()
  expect(preview.getByText('2027-08-13 – 2027-08-21')).toBeInTheDocument()
  expect(preview.queryByText(/available leave/)).not.toBeInTheDocument()
  expect(preview.getByText('Calculated 2026-09-26 · Asia/Jerusalem')).toBeInTheDocument()
  expect(
    previewSvg().querySelector('[data-date="2027-08-21"]')?.getAttribute('data-selected'),
  ).toBe('true')
  expect(
    previewSvg().querySelector('[data-date="2027-08-06"]')?.getAttribute('data-selected'),
  ).toBe('false')
})

test('leave details are independently opt-in and title changes match the preview without editing the plan', async () => {
  await workspace()
  const preview = await openPreview()
  expect(preview.getByRole('checkbox', { name: 'Include leave details' })).not.toBeChecked()
  fireEvent.click(preview.getByRole('checkbox', { name: 'Include leave details' }))
  expect(
    preview.getByText(
      '18 available leave · 8 leave used · 10 remaining leave · 3 protected reserve',
    ),
  ).toBeInTheDocument()
  expect(previewSvg().documentElement.textContent).toContain('18 available leave · 8 leave used')
  fireEvent.change(preview.getByLabelText('Card title'), { target: { value: 'Friends & family' } })
  expect(previewSvg().documentElement.textContent).toContain('Friends & family')
  fireEvent.click(preview.getByRole('checkbox', { name: 'Include leave details' }))
  expect(previewSvg().documentElement.textContent).not.toContain('available leave')
  expect(screen.getByLabelText('Available leave for included trips')).toHaveValue(18)
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('opening moves keyboard focus into the preview and Escape or Close returns it to the opener', async () => {
  await workspace()
  let preview = await openPreview()
  expect(preview.getByRole('heading', { name: 'Review your year card' })).toHaveFocus()
  fireEvent.keyDown(preview.getByLabelText('Card title'), { key: 'Escape' })
  expect(screen.queryByRole('region', { name: 'Year card preview' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview year card' })).toHaveFocus()
  preview = await openPreview()
  fireEvent.click(preview.getByRole('button', { name: 'Close year card' }))
  expect(screen.getByRole('button', { name: 'Preview year card' })).toHaveFocus()
})

test('the year card has an accessible corner close icon with a dismissible keyboard tooltip', async () => {
  await workspace()
  const preview = await openPreview()
  const close = preview.getByRole('button', { name: 'Close year card' })
  expect(close).not.toHaveTextContent('Close year card')
  act(() => close.focus())
  expect(preview.getByRole('tooltip')).toHaveTextContent('Close year card')
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(preview.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(close).toHaveFocus()
  expect(screen.getByRole('region', { name: 'Year card preview' })).toBeVisible()
  fireEvent.click(close)
  expect(screen.queryByRole('region', { name: 'Year card preview' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview year card' })).toHaveFocus()
})

function pngBrowser(pending = false) {
  const downloads: string[] = []
  let finish: (() => void) | undefined
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:card'
      }
      static revokeObjectURL() {}
    },
  )
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      set src(_value: string) {
        finish = () => this.onload?.()
        if (!pending) queueMicrotask(finish)
      }
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage() {},
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
  return { downloads, finish: () => finish?.() }
}

test('the image download action explains itself on focus and hover and still exports the reviewed PNG', async () => {
  await workspace()
  const preview = await openPreview()
  const browser = pngBrowser()
  const imageActions = within(preview.getByRole('group', { name: 'Year card image actions' }))
  const download = imageActions.getByRole('button', { name: 'Download PNG' })
  act(() => download.focus())
  expect(imageActions.getByRole('tooltip')).toHaveTextContent('Download year card as PNG')
  fireEvent.keyDown(download, { key: 'Escape' })
  expect(imageActions.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(download).toHaveFocus()
  fireEvent.blur(download)
  fireEvent.mouseEnter(download)
  expect(imageActions.getByRole('tooltip')).toHaveTextContent('Download year card as PNG')
  fireEvent.mouseLeave(download)
  expect(imageActions.queryByRole('tooltip')).not.toBeInTheDocument()
  fireEvent.click(download)
  await preview.findByText('PNG download started')
  expect(browser.downloads).toEqual(['vacation-year-2027.png'])
})

test('Escape dismisses a hovered export tooltip without closing the year card or moving focus', async () => {
  await workspace()
  const preview = await openPreview()
  const title = preview.getByLabelText('Card title')
  act(() => title.focus())
  fireEvent.mouseEnter(preview.getByRole('button', { name: 'Download PNG' }))
  expect(preview.getByRole('tooltip')).toBeVisible()
  fireEvent.keyDown(title, { key: 'Escape' })
  expect(preview.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Year card preview' })).toBeVisible()
  expect(title).toHaveFocus()
  fireEvent.keyDown(title, { key: 'Escape' })
  expect(screen.queryByRole('region', { name: 'Year card preview' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview year card' })).toHaveFocus()
})

test('closing a hovered appearance panel does not intercept Escape in a later preview', async () => {
  await workspace(true)
  fireEvent.click(screen.getByText('Appearance', { exact: true }))
  const close = screen.getByRole('button', { name: 'Close appearance settings' })
  fireEvent.mouseEnter(close)
  fireEvent.click(close)
  expect(screen.getByText('Appearance', { exact: true })).toHaveFocus()
  const preview = await openPreview()
  fireEvent.keyDown(preview.getByLabelText('Card title'), { key: 'Escape' })
  expect(screen.queryByRole('region', { name: 'Year card preview' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview year card' })).toHaveFocus()
})

test('explicit PNG download uses the reviewed settings and a visible filename', async () => {
  await workspace()
  const preview = await openPreview()
  const browser = pngBrowser()
  expect(preview.getByText('vacation-year-2027.png')).toBeInTheDocument()
  fireEvent.click(preview.getByRole('checkbox', { name: 'Include leave details' }))
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  expect(await preview.findByText('PNG download started')).toBeInTheDocument()
  expect(browser.downloads).toEqual(['vacation-year-2027.png'])
  expect(preview.getByRole('link', { name: 'Download prepared PNG' })).toHaveAttribute(
    'href',
    'data:image/png;base64,cG5n',
  )
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('an empty title reports validation and disables export until corrected', async () => {
  await workspace()
  const preview = await openPreview()
  fireEvent.change(preview.getByLabelText('Card title'), { target: { value: '' } })
  expect(preview.getByRole('alert')).toHaveTextContent('Choose a card title of 1–80 characters')
  expect(preview.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  fireEvent.change(preview.getByLabelText('Card title'), { target: { value: 'My next year' } })
  expect(preview.queryByRole('alert')).not.toBeInTheDocument()
  expect(preview.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})

test('a renamed historical saved plan previews and downloads offline without changing stored data', async () => {
  const storage = new MemoryOptionStorage()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as Storage)
  const run = annualRunSchema.parse(annualFixtureWithAlternatives())
  const snapshot = await createAnnualSnapshot(run, 'b'.repeat(64))
  const store = new SavedAnnualPlansStore(storage)
  store.save(snapshot)
  store.rename(snapshot.capture_id, 'The year of yes')
  const before = storage.getItem(storage.key(0)!)
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<SavedAnnualPlansView />)
  fireEvent.click(await screen.findByRole('button', { name: 'Open annual plan' }))
  const preview = await openPreview()
  expect(preview.getByLabelText('Card title')).toHaveValue('The year of yes')
  expect(preview.getByText('2027-08-13 – 2027-08-21')).toBeInTheDocument()
  expect(preview.getByText('Calculated 2026-09-26 · Asia/Jerusalem')).toBeInTheDocument()
  const browser = pngBrowser()
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  await preview.findByText('PNG download started')
  expect(browser.downloads).toEqual(['vacation-year-2027.png'])
  expect(storage.getItem(storage.key(0)!)).toBe(before)
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['draft', 'selection', 'navigation', 'close'])(
  '%s changes cancel pending PNG exports and invalidate the earlier preview',
  async (change) => {
    await workspace(change === 'navigation')
    const preview = await openPreview()
    const browser = pngBrowser(true)
    fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
    await preview.findByRole('button', { name: 'Preparing PNG…' })
    if (change === 'draft')
      fireEvent.change(screen.getByLabelText('Protected reserve'), { target: { value: '4' } })
    if (change === 'selection')
      fireEvent.click(screen.getByRole('button', { name: 'View Fewer leave days' }))
    if (change === 'navigation') fireEvent.click(screen.getByRole('button', { name: 'Find dates' }))
    if (change === 'close')
      fireEvent.click(preview.getByRole('button', { name: 'Close year card' }))
    await act(async () => {
      browser.finish()
      await Promise.resolve()
    })
    expect(browser.downloads).toEqual([])
    if (change === 'navigation')
      fireEvent.click(screen.getByRole('button', { name: 'Plan my year' }))
    expect(screen.queryByRole('region', { name: 'Year card preview' })).not.toBeInTheDocument()
  },
)

test('the readable reduced preview names omitted breaks and exact locked dates', async () => {
  render(<AnnualPlanResults result={sixBreakCardFixture(true)} />)
  const preview = await openPreview()
  expect(preview.getByText('Reduced mix: 4 of 6 breaks')).toBeInTheDocument()
  expect(preview.getByText('Omitted: Break 5, Break 6')).toBeInTheDocument()
  expect(preview.getByText('Break 1 · locked dates')).toBeInTheDocument()
  expect(preview.getByText('2028-02-26 – 2028-03-02')).toBeInTheDocument()
})

test('PNG failure is announced without a false download and an explicit retry can succeed', async () => {
  await workspace()
  const preview = await openPreview()
  const browser = pngBrowser()
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null)
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  expect(await preview.findByRole('alert')).toHaveTextContent(
    'The year card PNG could not be created',
  )
  expect(browser.downloads).toEqual([])
  expect(preview.queryByText('PNG download started')).not.toBeInTheDocument()
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  await preview.findByText('PNG download started')
  expect(browser.downloads).toEqual(['vacation-year-2027.png'])
  expect(preview.queryByRole('alert')).not.toBeInTheDocument()
})

test('changing privacy after PNG preparation removes the earlier download link', async () => {
  await workspace()
  const preview = await openPreview()
  pngBrowser()
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  await preview.findByRole('link', { name: 'Download prepared PNG' })
  fireEvent.click(preview.getByRole('checkbox', { name: 'Include leave details' }))
  expect(preview.queryByRole('link', { name: 'Download prepared PNG' })).not.toBeInTheDocument()
  expect(preview.queryByText('PNG download started')).not.toBeInTheDocument()
  expect(previewSvg().documentElement.textContent).toContain('18 available leave')
})

test('a file-reader failure cannot report or offer a completed download', async () => {
  await workspace()
  const preview = await openPreview()
  const browser = pngBrowser()
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementationOnce(function (
    this: FileReader,
  ) {
    queueMicrotask(() => this.dispatchEvent(new ProgressEvent('error')))
  })
  fireEvent.click(preview.getByRole('button', { name: 'Download PNG' }))
  expect(await preview.findByRole('alert')).toHaveTextContent(
    'The PNG could not be prepared for download',
  )
  expect(browser.downloads).toEqual([])
  expect(preview.queryByRole('link', { name: 'Download prepared PNG' })).not.toBeInTheDocument()
})
