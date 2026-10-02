import { useEffect, useRef, useState } from 'react'
import { createAnnualSnapshot, type AnnualResult, type AnnualSnapshot } from './savedAnnualPlans'
import { annualLeaveRequestText } from './annualLeaveRequest'

export default function AnnualLeaveRequestActions({
  result,
  planId,
  disabled = false,
}: {
  result: AnnualResult
  planId: string
  disabled?: boolean
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
        if (!cancelled) setError('This annual snapshot could not be prepared for copying.')
      })
    return () => {
      cancelled = true
    }
  }, [result, planId])
  const snapshot = capture?.result === result && capture.planId === planId ? capture.snapshot : null
  const unavailable = disabled || !snapshot
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
