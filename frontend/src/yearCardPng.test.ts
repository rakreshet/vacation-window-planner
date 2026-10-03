import { webcrypto } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import { annualFixture } from './annualFixtures'
import { annualRunSchema } from './annualContracts'
import { createAnnualSnapshot } from './savedAnnualPlans'
import { yearCardPng } from './yearCardPng'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function capture() {
  vi.stubGlobal('crypto', webcrypto)
  const run = annualRunSchema.parse(annualFixture())
  return createAnnualSnapshot(run, run.plans[0].plan_id)
}
function browser(failure = '') {
  const release = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:year-card'
      }
      static revokeObjectURL = release
    },
  )
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => (failure === 'image' ? this.onerror?.() : this.onload?.()))
      }
    },
  )
  const context = {
    drawImage: () => {
      if (failure === 'draw') throw new Error('denied')
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    failure === 'canvas' ? null : (context as unknown as CanvasRenderingContext2D),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
  ) {
    expect(this.width).toBe(1200)
    expect(this.height).toBe(1800)
    callback(failure === 'blob' ? null : new Blob(['rendered'], { type: 'image/png' }))
  })
  return release
}

test('browser conversion delivers a PNG blob at the card dimensions and releases the image URL', async () => {
  const snapshot = await capture()
  const release = browser()
  const blob = await yearCardPng(snapshot, { title: 'My year', includeLeaveDetails: false })
  expect(blob.type).toBe('image/png')
  expect(blob.size).toBeGreaterThan(0)
  expect(release).toHaveBeenCalledWith('blob:year-card')
})

test.each(['image', 'canvas', 'draw', 'blob'])(
  'a browser %s failure rejects export and releases resources',
  async (failure) => {
    const snapshot = await capture()
    const release = browser(failure)
    await expect(
      yearCardPng(snapshot, { title: 'My year', includeLeaveDetails: false }),
    ).rejects.toThrow(/could not/)
    expect(release).toHaveBeenCalledWith('blob:year-card')
  },
)

test('canceling a pending image conversion rejects without exporting and releases its URL', async () => {
  const snapshot = await capture()
  const release = browser()
  vi.stubGlobal(
    'Image',
    class {
      set src(_value: string) {}
    },
  )
  const controller = new AbortController()
  const conversion = yearCardPng(
    snapshot,
    { title: 'My year', includeLeaveDetails: false },
    controller.signal,
  )
  controller.abort()
  await expect(conversion).rejects.toMatchObject({ name: 'AbortError' })
  expect(release).toHaveBeenCalledWith('blob:year-card')
})
