import AnnualLockEditor from './AnnualLockEditor'
import type { AnnualDraft } from './annualDraft'

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export default function AnnualMixFields({
  draft,
  onChange,
}: {
  draft: AnnualDraft
  onChange: (draft: AnnualDraft) => void
}) {
  const localYear = Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: draft.planning.timeZone }).format(
      new Date(),
    ),
  )
  function move(index: number, offset: number) {
    const slots = [...draft.slots]
    ;[slots[index], slots[index + offset]] = [slots[index + offset], slots[index]]
    onChange({ ...draft, slots })
  }
  return (
    <>
      <div className="field-grid">
        <label className="field">
          Plan year
          <select
            value={draft.year}
            onChange={(event) => onChange({ ...draft, year: event.target.value })}
          >
            {[localYear, localYear + 1, localYear + 2].map((year) => (
              <option key={year}>{year}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Minimum dates between breaks
          <input
            type="number"
            min="0"
            max="60"
            value={draft.gap}
            onChange={(event) => onChange({ ...draft, gap: event.target.value })}
          />
        </label>
      </div>
      <p>
        Separate breaks also need at least one working date between them. Past dates are excluded
        from new breaks.
      </p>
      <fieldset className="annual-months">
        <legend>Start months for new breaks</legend>
        <div className="day-picker">
          {months.map((month, index) => (
            <label key={month}>
              <input
                type="checkbox"
                aria-label={month}
                checked={draft.months.includes(index + 1)}
                onChange={() =>
                  onChange({
                    ...draft,
                    months: draft.months.includes(index + 1)
                      ? draft.months.filter((value) => value !== index + 1)
                      : [...draft.months, index + 1].sort((a, b) => a - b),
                  })
                }
              />
              <span>{month.slice(0, 3)}</span>
            </label>
          ))}
        </div>
        <small>
          Only the start of a new break must be in these months. Locked dates stay fixed.
        </small>
      </fieldset>
      <h2>Your requested breaks</h2>
      <p>Locked trips count in this mix. Priority when reducing: top to bottom.</p>
      {draft.slots.map((slot, index) => (
        <fieldset className="annual-slot" key={slot.id}>
          <legend>Break {index + 1}</legend>
          <div className="field-grid">
            <label className="field">
              Minimum days away
              <input
                type="number"
                min={slot.dates ? '1' : '3'}
                max="28"
                value={slot.minimum}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    slots: draft.slots.map((item) =>
                      item.id === slot.id ? { ...item, minimum: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              Maximum days away
              <input
                type="number"
                min={slot.dates ? '1' : '3'}
                max="28"
                value={slot.maximum}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    slots: draft.slots.map((item) =>
                      item.id === slot.id ? { ...item, maximum: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
          </div>
          <AnnualLockEditor
            disabled={Boolean(draft.editingSlotId && draft.editingSlotId !== slot.id)}
            slot={slot}
            year={draft.year}
            onChange={(next) =>
              onChange({
                ...draft,
                editingSlotId: undefined,
                slots: draft.slots.map((item) => (item.id === next.id ? next : item)),
              })
            }
            onEditing={(editing) =>
              onChange({ ...draft, editingSlotId: editing ? slot.id : undefined })
            }
          />
          <div className="annual-slot-actions">
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
              Move up
            </button>
            <button
              type="button"
              disabled={index === draft.slots.length - 1}
              onClick={() => move(index, 1)}
            >
              Move down
            </button>
            <button
              type="button"
              disabled={draft.slots.length === 1}
              onClick={() =>
                onChange({ ...draft, slots: draft.slots.filter((item) => item.id !== slot.id) })
              }
            >
              {slot.dates ? 'Remove locked break' : 'Remove break'}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={draft.slots.length >= 6}
        onClick={() =>
          onChange({
            ...draft,
            slots: [...draft.slots, { id: crypto.randomUUID(), minimum: '3', maximum: '5' }],
          })
        }
      >
        Add a break
      </button>
    </>
  )
}
