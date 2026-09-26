import { useEffect, useRef, useState } from 'react'
import type { ActionSnapshot } from './actionSnapshots'
import { calendarFile, leaveRequestText } from './calendarExport'

export function downloadCalendar(snapshot: ActionSnapshot, title?: string) {
  const url = URL.createObjectURL(
    new Blob([calendarFile(snapshot, title)], { type: 'text/calendar;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `vacation-${snapshot.window.start_date}-${snapshot.window.end_date}.ics`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CopyPreview({
  snapshot,
  onClose,
}: {
  snapshot: ActionSnapshot
  onClose: () => void
}) {
  const text = leaveRequestText(snapshot)
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
    <section className="copy-preview" aria-label="Leave request preview">
      <h3>Review your leave request</h3>
      <textarea aria-label="Leave request text" ref={textarea} value={text} readOnly rows={9} />
      <button className="button button--primary" type="button" onClick={() => void copy()}>
        Copy text
      </button>
      <button className="button button--secondary" type="button" onClick={onClose}>
        Close preview
      </button>
      <p role="status">{message}</p>
    </section>
  )
}

export default function ExportActions({
  snapshot,
  title,
}: {
  snapshot: ActionSnapshot
  title?: string
}) {
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const opener = useRef<HTMLButtonElement>(null)
  return (
    <div className="window-actions">
      <button
        className="button button--secondary"
        type="button"
        onClick={() => {
          try {
            downloadCalendar(snapshot, title)
            setError('')
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Calendar download failed')
          }
        }}
      >
        Download calendar
      </button>
      <button
        className="button button--secondary"
        type="button"
        ref={opener}
        onClick={() => setPreview(true)}
      >
        Copy leave request
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <CopyPreview
          snapshot={snapshot}
          onClose={() => {
            setPreview(false)
            opener.current?.focus()
          }}
        />
      )}
    </div>
  )
}
