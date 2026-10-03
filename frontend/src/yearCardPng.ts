import type { AnnualSnapshot } from './savedAnnualPlans'
import { yearCardSvg, type YearCardOptions } from './yearCard'

export async function yearCardPng(
  snapshot: AnnualSnapshot,
  options: YearCardOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  const abortError = () => new DOMException('Year card canceled', 'AbortError')
  if (signal?.aborted) throw abortError()
  const svg = yearCardSvg(snapshot, options)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  let onAbort = () => undefined as void
  const canceled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError())
  })
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const image = new Image()
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Image unavailable'))
        image.src = url
      }),
      canceled,
    ])
    if (signal?.aborted) throw abortError()
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1800
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0)
    return await Promise.race([
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob?.size && blob.type === 'image/png'
              ? resolve(blob)
              : reject(new Error('PNG unavailable')),
          'image/png',
        ),
      ),
      canceled,
    ])
  } catch (error) {
    if (signal?.aborted) throw abortError()
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('The year card PNG could not be created. Try again or use another browser.', {
      cause: error,
    })
  } finally {
    signal?.removeEventListener('abort', onAbort)
    URL.revokeObjectURL(url)
  }
}
