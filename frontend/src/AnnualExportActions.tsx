import { useEffect, useRef, useState } from 'react'
import { createAnnualSnapshot, type AnnualResult, type AnnualSnapshot } from './savedAnnualPlans'
import { annualCalendarFile, annualLeaveRequestText } from './annualCalendarExport'

export default function AnnualExportActions({
  result,
  planId,
  disabled = false,
  title,
}: {
  result: AnnualResult
  planId: string
  disabled?: boolean
  title?: string
}) {
  const [capture, setCapture] = useState<{
    result: AnnualResult
    planId: string
    snapshot: AnnualSnapshot
  } | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<AnnualSnapshot | null>(null)
  const [includeBudget, setIncludeBudget] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let cancelled = false
    void createAnnualSnapshot(result, planId)
      .then((snapshot) => {
        if (!cancelled) setCapture({ result, planId, snapshot })
      })
      .catch(() => {
        if (!cancelled) setError('This annual snapshot could not be prepared for export.')
      })
    return () => {
      cancelled = true
    }
  }, [result, planId])
  const snapshot = capture?.result === result && capture.planId === planId ? capture.snapshot : null
  const unavailable = disabled || !snapshot
  function download() {
    if (unavailable || !snapshot) return
    try {
      const url = URL.createObjectURL(
        new Blob([annualCalendarFile(snapshot, title, includeBudget)], {
          type: 'text/calendar;charset=utf-8',
        }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `annual-vacations-${result.input.year}.ics`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Calendar download failed')
    }
  }
  return (
    <div className="window-actions">
      <label>
        <input
          type="checkbox"
          checked={includeBudget}
          disabled={unavailable}
          onChange={(event) => setIncludeBudget(event.target.checked)}
        />
        Include budget and reserve
      </label>
      <button
        className="button button--secondary"
        type="button"
        disabled={unavailable}
        onClick={download}
      >
        Download annual calendar
      </button>
      <button
        className="button button--secondary"
        type="button"
        disabled={unavailable}
        ref={opener}
        onClick={() => setPreview(snapshot)}
      >
        Copy annual leave request
      </button>
      {error && <p role="alert">{error}</p>}
      {preview === snapshot && !unavailable && snapshot && (
        <AnnualCopyPreview
          key={String(includeBudget)}
          snapshot={snapshot}
          includeBudget={includeBudget}
          onClose={() => {
            setPreview(null)
            opener.current?.focus()
          }}
        />
      )}
    </div>
  )
}

function AnnualCopyPreview({
  snapshot,
  includeBudget,
  onClose,
}: {
  snapshot: AnnualSnapshot
  includeBudget: boolean
  onClose: () => void
}) {
  const text = annualLeaveRequestText(snapshot, includeBudget)
  const [message, setMessage] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    textarea.current?.focus()
  }, [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Copied to clipboard')
    } catch {
      setMessage('Clipboard unavailable. Select the text and copy it manually.')
      textarea.current?.focus()
      textarea.current?.select()
    }
  }
  return (
    <section className="copy-preview" aria-label="Annual leave request preview">
      <h3>Review your annual leave request</h3>
      <textarea
        ref={textarea}
        readOnly
        rows={12}
        aria-label="Annual leave request text"
        value={text}
      />
      <button type="button" onClick={() => void copy()}>
        Copy annual text
      </button>
      <button type="button" onClick={onClose}>
        Close annual preview
      </button>
      <p role="status">{message}</p>
    </section>
  )
}
