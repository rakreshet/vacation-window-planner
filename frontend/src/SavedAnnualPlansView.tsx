import AnnualSavedContext from './AnnualSavedContext'
import { useEffect, useRef, useState } from 'react'
import AnnualPlanResults from './AnnualPlanResults'
import AnnualPlanWorkspace from './AnnualPlanWorkspace'
import {
  annualPlansChanged,
  browserAnnualPlans,
  notifyAnnualPlansChanged,
} from './browserAnnualPlans'
import type { SavedAnnualPlan } from './savedAnnualPlans'
import { draftFromAnnual } from './annualDraft'

export default function SavedAnnualPlansView() {
  const [records, setRecords] = useState<{ items: SavedAnnualPlan[]; invalid: string[] }>({
    items: [],
    invalid: [],
  })
  const [selected, setSelected] = useState<SavedAnnualPlan | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [removed, setRemoved] = useState<{ key: string; raw: string | null } | null>(null)
  const [error, setError] = useState('')
  const opener = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    function refresh() {
      try {
        setRecords(browserAnnualPlans().list())
        setError('')
      } catch {
        setError('Browser storage is unavailable. Existing plans have not been cleared.')
      }
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(annualPlansChanged, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(annualPlansChanged, refresh)
    }
  }, [])
  function change(action: () => void) {
    try {
      action()
      notifyAnnualPlansChanged()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update saved annual plans')
      return false
    }
  }
  function remove(id: string) {
    change(() => {
      setRemoved(browserAnnualPlans().remove(id))
      if (selected?.snapshot.capture_id === id) setSelected(null)
    })
  }
  return (
    <>
      <section
        className="planner-card saved-options"
        hidden={recalculating}
        aria-label="Saved annual plans"
      >
        <h1>Saved annual plans</h1>
        <p>
          Stored only in this browser and profile. Clearing browser data removes these plans. Saving
          does not deduct or approve leave.
        </p>
        {error && <p role="alert">{error}</p>}
        {!records.items.length && !error && <p>No saved annual plans yet.</p>}
        {removed && (
          <p role="status">
            Annual plan removed.{' '}
            <button
              type="button"
              onClick={() =>
                change(() => {
                  browserAnnualPlans().restore(removed)
                  setRemoved(null)
                })
              }
            >
              Undo annual removal
            </button>
          </p>
        )}
        {records.invalid.map((key) => (
          <article key={key}>
            <p>
              This annual plan is damaged or uses an unsupported version. Other plans are
              unaffected.
            </p>
            <button type="button" onClick={() => remove(key)}>
              Remove unavailable annual plan
            </button>
          </article>
        ))}
        {records.items.map((item) => (
          <article className="recommendation-card" key={item.snapshot.capture_id}>
            <h2>{item.name}</h2>
            <p>
              {item.snapshot.result.input.year} · {item.snapshot.result.plans[0].breaks.length}{' '}
              breaks · {item.snapshot.result.plans[0].accounting.total_leave_used} used ·{' '}
              {item.snapshot.result.plans[0].accounting.remaining_days} remaining ·{' '}
              {item.snapshot.result.input.reserve_days} reserved
            </p>
            <p>
              Calculated {item.snapshot.result.calculation_context.calculated_at}
              {item.snapshot.result.plans[0].fulfillment === 'reduced' ? ' · Reduced plan' : ''}
            </p>
            <AnnualName
              item={item}
              onRename={(name) =>
                change(() => browserAnnualPlans().rename(item.snapshot.capture_id, name))
              }
            />
            <button type="button" onClick={() => remove(item.snapshot.capture_id)}>
              Remove annual plan
            </button>
            <button type="button" onClick={() => setSelected(item)}>
              Open annual plan
            </button>
          </article>
        ))}
        {selected && (
          <section aria-label="Saved annual calculation">
            <p>
              Historical annual calculation ·{' '}
              {selected.snapshot.result.calculation_context.calculated_at}. Review current budget
              and calendar before recalculating.
            </p>
            <AnnualSavedContext result={selected.snapshot.result} />
            <AnnualPlanResults result={selected.snapshot.result} />
            <button ref={opener} type="button" onClick={() => setRecalculating(true)}>
              Recalculate this plan
            </button>
          </section>
        )}
      </section>
      {recalculating && selected && (
        <div>
          <button
            type="button"
            onClick={() => {
              setRecalculating(false)
              setTimeout(() => opener.current?.focus(), 0)
            }}
          >
            Back to saved annual plan
          </button>
          <AnnualPlanWorkspace
            initialPlanning={draftFromAnnual(selected.snapshot.result).planning}
            initialDraft={draftFromAnnual(selected.snapshot.result)}
            idPrefix="saved-annual-"
          />
        </div>
      )}
    </>
  )
}

function AnnualName({
  item,
  onRename,
}: {
  item: SavedAnnualPlan
  onRename: (name: string) => boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => {
          setName(item.name)
          setEditing(true)
        }}
      >
        Rename annual plan
      </button>
    )
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (onRename(name)) setEditing(false)
      }}
    >
      <label className="field">
        Annual plan name
        <input
          value={name}
          maxLength={80}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit">Save annual name</button>
      <button type="button" onClick={() => setEditing(false)}>
        Cancel annual rename
      </button>
    </form>
  )
}
