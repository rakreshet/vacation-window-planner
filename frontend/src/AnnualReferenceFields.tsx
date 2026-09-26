import { useState } from 'react'
import { browserSavedOptions } from './browserSavedOptions'
import type { SavedOption } from './savedOptions'

export type AnnualReferenceResolution = {
  slot: string
  start_date: string
  end_date: string
  savedId?: string
}
export default function AnnualReferenceFields({
  description,
  slots,
  value,
  onChange,
}: {
  description: string
  slots: string[]
  value: AnnualReferenceResolution
  onChange: (value: AnnualReferenceResolution) => void
}) {
  const [saved] = useState<{ items: SavedOption[]; error: string }>(() => {
    try {
      const list = browserSavedOptions().list()
      return {
        items: list.items,
        error: list.invalid.length
          ? 'Some saved trips could not be read. Enter dates manually.'
          : '',
      }
    } catch {
      return { items: [], error: 'Saved trips are unavailable. Enter dates manually.' }
    }
  })
  return (
    <fieldset>
      <legend>Resolve: {description}</legend>
      <p>
        Choose saved dates explicitly or enter dates below. Their cost will use the annual calendar.
      </p>
      {saved.error && <p role="status">{saved.error}</p>}
      <label className="field">
        Saved trip for {description}
        <select
          value={value.savedId ?? ''}
          onChange={(event) => {
            const selected = saved.items.find(
              (item) => item.snapshot.capture_id === event.target.value,
            )
            onChange({
              ...value,
              savedId: selected?.snapshot.capture_id,
              start_date: selected?.snapshot.window.start_date ?? '',
              end_date: selected?.snapshot.window.end_date ?? '',
            })
          }}
        >
          <option value="">Choose a saved trip or enter dates</option>
          {saved.items.map((item) => (
            <option key={item.snapshot.capture_id} value={item.snapshot.capture_id}>
              {item.name}: {item.snapshot.window.start_date} – {item.snapshot.window.end_date}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Start date for {description}
        <input
          type="date"
          value={value.start_date}
          onChange={(event) =>
            onChange({ ...value, savedId: undefined, start_date: event.target.value })
          }
        />
      </label>
      <label className="field">
        End date for {description}
        <input
          type="date"
          value={value.end_date}
          onChange={(event) =>
            onChange({ ...value, savedId: undefined, end_date: event.target.value })
          }
        />
      </label>
      <label className="field">
        Slot for {description}
        <select
          value={value.slot}
          onChange={(event) => onChange({ ...value, slot: event.target.value })}
        >
          <option value="">Choose a slot explicitly</option>
          {slots.map((label, index) => (
            <option key={index} value={index}>
              Break {index + 1}: {label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}
