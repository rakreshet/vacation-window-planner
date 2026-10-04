import { useEffect, useRef, useState } from 'react'
import type { ActionSnapshot } from './actionSnapshots'
import { leaveRequestText } from './leaveRequest'
import { PanelCloseButton } from './ActionButton'

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
    <section
      className="copy-preview"
      aria-label="Leave request preview"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="panel-header">
        <h3>Review your leave request</h3>
        <PanelCloseButton label="Close preview" onClick={onClose} />
      </div>
      <textarea aria-label="Leave request text" ref={textarea} value={text} readOnly rows={9} />
      <button className="button button--primary" type="button" onClick={() => void copy()}>
        Copy text
      </button>
      <p role="status">{message}</p>
    </section>
  )
}

export default function LeaveRequestActions({ snapshot }: { snapshot: ActionSnapshot }) {
  const [preview, setPreview] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  return (
    <div className="window-actions">
      <button
        className="button button--secondary"
        type="button"
        ref={opener}
        onClick={() => setPreview(true)}
      >
        Copy leave request
      </button>
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
