import { useEffect, useRef, useState } from 'react'
import type { CalculationContext, Recommendation, WindowAssessment } from './api'
import { createActionSnapshot } from './actionSnapshots'
import type { ActionMetadata, ActionSnapshot, ActionSource } from './actionSnapshots'
import { browserSavedOptions, notifySavedOptionsChanged } from './browserSavedOptions'
import type { SavedOptionsStore } from './savedOptions'
import { CopyPreview, downloadCalendar } from './ExportActions'

type WindowActionsProps = {
  source: ActionSource
  window: Recommendation['window']
  assessment: WindowAssessment
  context: CalculationContext
  metadata?: ActionMetadata
  stale?: boolean
  store?: SavedOptionsStore
}
const actionLabels = {
  save: 'Save option',
  download: 'Download calendar',
  copy: 'Copy leave request',
}
type Action = keyof typeof actionLabels

export default function WindowActions(props: WindowActionsProps) {
  if (props.stale)
    return (
      <div className="window-actions">
        {Object.values(actionLabels).map((label) => (
          <button type="button" className="button button--secondary" disabled key={label}>
            {label}
          </button>
        ))}
      </div>
    )
  return (
    <CurrentWindowActions
      key={`${props.context.calculated_at}:${props.window.start_date}:${props.window.end_date}`}
      {...props}
    />
  )
}

function CurrentWindowActions({
  source,
  window,
  assessment,
  context,
  metadata,
  store,
}: WindowActionsProps) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<ActionSnapshot | null>(null)
  const alive = useRef(true)
  const opener = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  async function perform(action: Action) {
    setBusy(true)
    try {
      const snapshot = await createActionSnapshot(source, window, assessment, context, metadata)
      if (!alive.current) return
      if (action === 'copy') setPreview(snapshot)
      else if (action === 'download') downloadCalendar(snapshot)
      else {
        const result = (store ?? browserSavedOptions()).save(snapshot)
        setMessage(result.status === 'saved' ? 'Option saved' : 'Already saved')
        notifySavedOptionsChanged()
      }
    } catch (caught) {
      if (alive.current)
        setMessage(caught instanceof Error ? caught.message : 'Could not complete this action')
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  return (
    <div className="window-actions">
      {(Object.keys(actionLabels) as Action[]).map((action) => (
        <button
          key={action}
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={(event) => {
            opener.current = event.currentTarget
            void perform(action)
          }}
        >
          {actionLabels[action]}
        </button>
      ))}
      <span role="status">{message}</span>
      {preview && (
        <CopyPreview
          snapshot={preview}
          onClose={() => {
            setPreview(null)
            opener.current?.focus()
          }}
        />
      )}
    </div>
  )
}
