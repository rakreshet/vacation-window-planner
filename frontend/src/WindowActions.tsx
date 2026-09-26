import { useRef, useState } from 'react'
import type { CalculationContext, Recommendation, WindowAssessment } from './api'
import { createActionSnapshot } from './actionSnapshots'
import type { ActionMetadata, ActionSource } from './actionSnapshots'
import { browserSavedOptions, notifySavedOptionsChanged } from './browserSavedOptions'
import type { SavedOptionsStore } from './savedOptions'

export default function WindowActions({
  source,
  window,
  assessment,
  context,
  metadata,
  stale = false,
  store,
}: {
  source: ActionSource
  window: Recommendation['window']
  assessment: WindowAssessment
  context: CalculationContext
  metadata?: ActionMetadata
  stale?: boolean
  store?: SavedOptionsStore
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const current = useRef({ stale, window, context })
  current.current = { stale, window, context }
  async function save() {
    setBusy(true)
    try {
      const snapshot = await createActionSnapshot(source, window, assessment, context, metadata)
      if (
        current.current.stale ||
        current.current.window !== window ||
        current.current.context !== context
      )
        return
      const result = (store ?? browserSavedOptions()).save(snapshot)
      setMessage(result.status === 'saved' ? 'Option saved' : 'Already saved')
      notifySavedOptionsChanged()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this option')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="window-actions">
      <button
        type="button"
        className="button button--secondary"
        disabled={stale || busy}
        onClick={() => void save()}
      >
        Save option
      </button>
      <span role="status">{message}</span>
    </div>
  )
}
