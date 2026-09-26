import ExportActions from './ExportActions'
import { useEffect, useState } from 'react'
import type { ActionSnapshot } from './actionSnapshots'
import {
  browserSavedOptions,
  notifySavedOptionsChanged,
  savedOptionsChanged,
} from './browserSavedOptions'
import type { SavedOption, SavedOptionsList, SavedOptionsStore } from './savedOptions'
import { WindowSummary } from './ComparisonResults'

export function snapshotEvaluation(snapshot: ActionSnapshot) {
  return {
    ...snapshot.assessment,
    feasible: snapshot.assessment.eligible,
    assessment: snapshot.assessment,
    weekend_dates: snapshot.assessment.day_details
      .filter((day) => day.is_weekend)
      .map((day) => day.date),
  }
}

export default function SavedOptionsView({
  onCheck,
  store,
}: {
  onCheck: (snapshot: ActionSnapshot) => void
  store?: SavedOptionsStore
}) {
  const [records, setRecords] = useState<SavedOptionsList>({ items: [], invalid: [] })
  const [error, setError] = useState('')
  const [removed, setRemoved] = useState<{ key: string; raw: string | null } | null>(null)
  function access() {
    return store ?? browserSavedOptions()
  }
  function refresh() {
    try {
      setRecords(access().list())
      setError('')
    } catch {
      setError('Browser storage is unavailable. Existing saved data has not been cleared.')
    }
  }
  useEffect(() => {
    const reload = () => {
      try {
        setRecords((store ?? browserSavedOptions()).list())
        setError('')
      } catch {
        setError('Browser storage is unavailable. Existing saved data has not been cleared.')
      }
    }
    reload()
    window.addEventListener('storage', reload)
    window.addEventListener(savedOptionsChanged, reload)
    return () => {
      window.removeEventListener('storage', reload)
      window.removeEventListener(savedOptionsChanged, reload)
    }
  }, [store])
  function change(action: () => void) {
    try {
      action()
      refresh()
      notifySavedOptionsChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update saved options')
    }
  }
  function remove(id: string) {
    change(() => setRemoved(access().remove(id)))
  }
  return (
    <section className="planner-card saved-options" aria-labelledby="saved-heading">
      <h1 id="saved-heading">Saved options</h1>
      <p>
        Stored only in this browser. Clearing browser data removes these options; private browsing
        may not retain them. Saving does not deduct or approve leave.
      </p>
      {error && <p role="alert">{error}</p>}
      {removed && (
        <div role="status">
          Option removed.{' '}
          <button
            type="button"
            onClick={() =>
              change(() => {
                access().restore(removed)
                setRemoved(null)
              })
            }
          >
            Undo remove
          </button>
        </div>
      )}
      {!records.items.length && !records.invalid.length && !error && <p>No saved options yet.</p>}
      {records.invalid.map((key) => (
        <article key={key} className="form-notice">
          <p>
            This saved option is damaged or uses an unsupported version. Other options are
            unaffected.
          </p>
          <button type="button" onClick={() => remove(key)}>
            Remove unavailable option
          </button>
        </article>
      ))}
      {records.items.map((item) => (
        <SavedOptionCard
          key={item.snapshot.capture_id}
          item={item}
          onCheck={onCheck}
          onRemove={() => remove(item.snapshot.capture_id)}
          onRename={(name) => change(() => access().rename(item.snapshot.capture_id, name))}
        />
      ))}
    </section>
  )
}

function SavedOptionCard({
  item,
  onCheck,
  onRemove,
  onRename,
}: {
  item: SavedOption
  onCheck: (snapshot: ActionSnapshot) => void
  onRemove: () => void
  onRename: (name: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(item.name)
  return (
    <article className="recommendation-card">
      <h2>{item.name}</h2>
      <ExportActions snapshot={item.snapshot} title={item.name} />
      <p>
        Historical calculation · {item.snapshot.context.calculated_at} ·{' '}
        {item.snapshot.context.planning.time_zone}
      </p>
      {renaming ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onRename(name)
            setRenaming(false)
          }}
        >
          <label>
            Option name
            <input
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit">Save name</button>
          <button type="button" onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setName(item.name)
            setRenaming(true)
          }}
        >
          Rename
        </button>
      )}
      <button type="button" onClick={onRemove}>
        Remove
      </button>
      <details>
        <summary>View saved calculation and rules</summary>
        <WindowSummary value={snapshotEvaluation(item.snapshot)} label="Saved dates" />
        <p>
          Calendar: {item.snapshot.context.planning.country_code} · Minimum notice:{' '}
          {item.snapshot.context.planning.personal_calendar.minimum_notice_days} days
        </p>
        <ul>
          {item.snapshot.context.planning.personal_calendar.date_overrides.map((rule) => (
            <li key={`${rule.kind}-${rule.start_date}`}>
              {rule.kind.replaceAll('_', ' ')}: {rule.start_date} – {rule.end_date}
            </li>
          ))}
        </ul>
        <ul>
          {item.snapshot.context.planning.personal_calendar.unavailable_ranges.map((rule) => (
            <li key={rule.start_date}>
              Unavailable: {rule.start_date} – {rule.end_date}
            </li>
          ))}
        </ul>
      </details>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => onCheck(item.snapshot)}
      >
        Check these dates
      </button>
    </article>
  )
}
