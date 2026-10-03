import { yearCardPng } from './yearCardPng'
import { useEffect, useRef, useState } from 'react'
import { createAnnualSnapshot, type AnnualResult, type AnnualSnapshot } from './savedAnnualPlans'
import { yearCardSvg } from './yearCard'
import ActionButton, { PanelCloseButton } from './ActionButton'

export default function YearCardActions({
  result,
  planId,
  disabled = false,
  title = 'My year of time away',
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
  const [preview, setPreview] = useState<AnnualSnapshot | null>(null)
  const [error, setError] = useState('')
  const opener = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let canceled = false
    void createAnnualSnapshot(result, planId)
      .then((snapshot) => {
        if (!canceled) setCapture({ result, planId, snapshot })
      })
      .catch(() => {
        if (!canceled) setError('This year card could not be prepared. Try calculating again.')
      })
    return () => {
      canceled = true
    }
  }, [result, planId])
  const snapshot = capture?.result === result && capture.planId === planId ? capture.snapshot : null
  return (
    <div className="year-card-actions">
      <ActionButton
        label="Preview year card"
        icon="image"
        className="button--secondary"
        ref={opener}
        disabled={disabled || !snapshot}
        onClick={() => setPreview(snapshot)}
      >
        Preview year card
      </ActionButton>
      {error && <p role="alert">{error}</p>}
      {snapshot && preview === snapshot && !disabled && (
        <YearCardPreview
          snapshot={snapshot}
          title={title}
          onClose={() => {
            setPreview(null)
            opener.current?.focus()
          }}
        />
      )}
    </div>
  )
}
function YearCardPreview({
  snapshot,
  title: initialTitle,
  onClose,
}: {
  snapshot: AnnualSnapshot
  title: string
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [exportError, setExportError] = useState('')
  const active = useRef<AbortController | null>(null)
  const [prepared, setPrepared] = useState<string | null>(null)
  useEffect(
    () => () => {
      active.current?.abort()
    },
    [],
  )
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const [title, setTitle] = useState(initialTitle)
  const [includeLeaveDetails, setIncludeLeaveDetails] = useState(false)
  const result = snapshot.result
  const plan = result.plans[0]
  let svg = ''
  let validationError = ''
  try {
    svg = yearCardSvg(snapshot, { title, includeLeaveDetails })
  } catch (error) {
    validationError =
      error instanceof Error ? error.message : 'The year card could not be prepared.'
  }
  const filename = `vacation-year-${result.input.year}.png`
  function clearPrepared() {
    setPrepared(null)
    setMessage('')
  }
  async function download() {
    if (active.current || !svg) return
    const controller = new AbortController()
    active.current = controller
    clearPrepared()
    setBusy(true)
    setMessage('')
    setExportError('')
    try {
      const blob = await yearCardPng(snapshot, { title, includeLeaveDetails }, controller.signal)
      if (controller.signal.aborted) return
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
          typeof reader.result === 'string' && reader.result.startsWith('data:image/png;base64,')
            ? resolve(reader.result)
            : reject(new Error('The PNG could not be prepared for download.'))
        reader.onerror = () => reject(new Error('The PNG could not be prepared for download.'))
        reader.readAsDataURL(blob)
      })
      if (controller.signal.aborted) return
      setPrepared(url)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.append(anchor)
      try {
        anchor.click()
        setMessage('PNG download started')
      } finally {
        anchor.remove()
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(
          error instanceof Error ? error.message : 'The PNG could not be downloaded. Try again.',
        )
    } finally {
      if (active.current === controller) {
        active.current = null
        if (!controller.signal.aborted) setBusy(false)
      }
    }
  }
  return (
    <section
      className="year-card-preview"
      aria-label="Year card preview"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="panel-header">
        <h3 ref={heading} tabIndex={-1}>
          Review your year card
        </h3>
        <PanelCloseButton label="Close year card" onClick={onClose} />
      </div>
      <label className="field">
        Card title
        <input
          disabled={busy}
          value={title}
          maxLength={80}
          onChange={(event) => {
            clearPrepared()
            setTitle(event.target.value)
          }}
        />
      </label>
      <label className="year-card-privacy">
        <input
          type="checkbox"
          disabled={busy}
          checked={includeLeaveDetails}
          onChange={(event) => {
            clearPrepared()
            setIncludeLeaveDetails(event.target.checked)
          }}
        />
        Include leave details
      </label>
      <div className="year-card-artwork">
        <div className="year-card-image-toolbar" role="group" aria-label="Year card image actions">
          <div className="year-card-file">
            <strong>{busy ? 'Preparing PNG…' : 'Save your year'}</strong>
            <span className="year-card-filename">{filename}</span>
          </div>
          <span className="year-card-format">PNG</span>
          <ActionButton
            label={busy ? 'Preparing PNG…' : 'Download PNG'}
            icon={busy ? 'progress' : 'download'}
            aria-busy={busy}
            tooltip={busy ? 'Preparing PNG…' : 'Download year card as PNG'}
            className={`year-card-download ${busy ? 'is-preparing' : ''}`}
            disabled={busy || !svg}
            onClick={() => void download()}
          />
        </div>
        {svg && (
          <img
            className="year-card-image"
            alt="Year card image"
            src={prepared ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          />
        )}
      </div>
      <div className="year-card-text">
        <p>
          {plan.accounting.total_days_away} days away · {plan.breaks.length}{' '}
          {plan.breaks.length === 1 ? 'break' : 'breaks'}
        </p>
        {includeLeaveDetails && (
          <p>
            {plan.accounting.available_days} available leave · {plan.accounting.total_leave_used}{' '}
            leave used · {plan.accounting.remaining_days} remaining leave ·{' '}
            {plan.accounting.reserve_days} protected reserve
          </p>
        )}
        <ol>
          {plan.breaks.map((item) => (
            <li key={item.slot_id}>
              <strong>
                Break {result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1}
                {item.locked ? ' · locked dates' : ''}
              </strong>
              <span>
                {item.window.start_date} – {item.window.end_date}
              </span>
            </li>
          ))}
        </ol>
        {plan.fulfillment === 'reduced' && (
          <>
            <p>
              Reduced mix: {plan.breaks.length} of {result.input.slots.length} breaks
            </p>
            <p>
              Omitted:{' '}
              {plan.omitted_slot_ids
                .map(
                  (id) =>
                    `Break ${result.input.slots.findIndex((slot) => slot.slot_id === id) + 1}`,
                )
                .join(', ')}
            </p>
          </>
        )}
        <p>
          Calculated {result.calculation_context.local_today} ·{' '}
          {result.calculation_context.planning.time_zone}
        </p>
        <p>Proposed plan · leave approval is separate</p>
      </div>
      {validationError && <p role="alert">{validationError}</p>}
      {prepared && (
        <a href={prepared} download={filename}>
          Download prepared PNG
        </a>
      )}
      {exportError && <p role="alert">{exportError}</p>}
      <p role="status">{message}</p>
    </section>
  )
}
