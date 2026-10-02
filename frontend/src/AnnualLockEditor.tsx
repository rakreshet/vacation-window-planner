import DateRangeFields from './DateRangeFields'
import { annualDateBounds, inclusiveCalendarDays } from './calendarDays'
import { useState } from 'react'
import { browserSavedOptions } from './browserSavedOptions'
import type { SavedOption } from './savedOptions'
import type { AnnualSlotDraft } from './annualDraft'

export default function AnnualLockEditor({
  slot,
  year,
  timeZone,
  onChange,
  onEditing,
  disabled = false,
}: {
  slot: AnnualSlotDraft
  year: string
  timeZone?: string
  onChange: (slot: AnnualSlotDraft) => void
  onEditing: (editing: boolean) => void
  disabled?: boolean
}) {
  const bounds = annualDateBounds(year, timeZone)
  const [saved, setSaved] = useState<SavedOption[] | null>(null)
  const [selectedSaved, setSelectedSaved] = useState<SavedOption | null>(null)
  const [open, setOpen] = useState(false)
  const [dates, setDates] = useState(slot.dates ?? { start_date: '', end_date: '' })
  const [error, setError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)
  function close() {
    setOpen(false)
    onEditing(false)
    setError(null)
    setMismatch(false)
  }
  function keep(convert = false) {
    if (dates.start_date && dates.start_date < bounds.minimum) {
      setMismatch(false)
      setError('Choose a start date today or later within the plan year')
      return
    }
    const length = inclusiveCalendarDays(dates.start_date, dates.end_date)
    if (
      !Number.isInteger(length) ||
      length < 1 ||
      length > 28 ||
      ![dates.start_date, dates.end_date].every((date) => date.startsWith(`${year}-`))
    ) {
      setError('Choose 1 to 28 consecutive dates within the plan year')
      return
    }
    if (!convert && (length < Number(slot.minimum) || length > Number(slot.maximum))) {
      setMismatch(true)
      setError('Dates do not fit this break. Edit its range or convert to an exact-date break.')
      return
    }
    close()
    onChange({
      ...slot,
      dates,
      ...(convert ? { minimum: String(length), maximum: String(length) } : {}),
    })
  }
  return (
    <div className="annual-lock-editor">
      {slot.dates && (
        <p>
          Locked: {slot.dates.start_date} – {slot.dates.end_date}
        </p>
      )}
      {!open && (
        <button
          disabled={disabled}
          type="button"
          onClick={() => {
            setDates(slot.dates ?? { start_date: '', end_date: '' })
            setOpen(true)
            onEditing(true)
          }}
        >
          {slot.dates ? 'Edit locked dates' : 'Add exact dates'}
        </button>
      )}
      {slot.dates && !open && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const minimum = Number(slot.minimum)
            const maximum = Number(slot.maximum)
            if (
              !Number.isInteger(minimum) ||
              !Number.isInteger(maximum) ||
              minimum < 3 ||
              maximum > 28 ||
              minimum > maximum
            ) {
              setError('Choose a generated range of 3 to 28 days before unlocking')
              return
            }
            setError(null)
            onChange({ ...slot, dates: undefined })
          }}
        >
          Unlock dates
        </button>
      )}
      {!open && error && <p role="alert">{error}</p>}
      {open && (
        <>
          <p>These dates fill this break. Their leave cost will use your annual calendar.</p>
          <button
            type="button"
            onClick={() => {
              try {
                const list = browserSavedOptions().list()
                setSaved(list.items)
                if (list.invalid.length)
                  setError('Some saved vacations could not be read. You can still enter dates.')
              } catch {
                setError('Saved vacations are unavailable. You can still enter dates.')
              }
            }}
          >
            Choose a saved vacation
          </button>
          {saved && (
            <label className="field">
              Saved vacation
              <select
                value={selectedSaved?.snapshot.capture_id ?? ''}
                onChange={(event) => {
                  const item =
                    saved.find((option) => option.snapshot.capture_id === event.target.value) ??
                    null
                  setSelectedSaved(item)
                  if (item)
                    setDates({
                      start_date: item.snapshot.window.start_date,
                      end_date: item.snapshot.window.end_date,
                    })
                }}
              >
                <option value="">Choose dates explicitly</option>
                {saved.map((item) => (
                  <option key={item.snapshot.capture_id} value={item.snapshot.capture_id}>
                    {item.name} — {item.snapshot.window.start_date} to{' '}
                    {item.snapshot.window.end_date}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedSaved && (
            <p>
              Previously calculated: {selectedSaved.snapshot.window.vacation_days_used} vacation
              days under its saved calendar
            </p>
          )}
          <DateRangeFields
            value={dates}
            onChange={setDates}
            {...bounds}
            startLabel="Locked start date"
            endLabel="Locked end date"
          />
          {error && <p role="alert">{error}</p>}
          <button type="button" onClick={() => keep()}>
            Keep these dates
          </button>
          {mismatch && (
            <button type="button" onClick={() => keep(true)}>
              Convert to exact-date break
            </button>
          )}
          <button type="button" onClick={close}>
            Cancel dates
          </button>
        </>
      )}
    </div>
  )
}
