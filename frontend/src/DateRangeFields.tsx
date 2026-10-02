import { useId } from 'react'
import type { DateRange } from './api'

export default function DateRangeFields({
  value,
  onChange,
  minimum,
  maximum,
  startLabel = 'Start date',
  endLabel = 'End date',
  required = false,
}: {
  value: DateRange
  onChange: (value: DateRange) => void
  minimum?: string
  maximum?: string
  startLabel?: string
  endLabel?: string
  required?: boolean
}) {
  const prefix = useId()
  const endMinimum = [minimum, value.start_date].filter(Boolean).sort().at(-1)
  const reversed = Boolean(value.start_date && value.end_date && value.end_date < value.start_date)
  return (
    <>
      <div className="field-grid">
        <div className="field">
          <label htmlFor={`${prefix}-start`}>{startLabel}</label>
          <input
            id={`${prefix}-start`}
            type="date"
            required={required}
            min={minimum}
            max={maximum}
            value={value.start_date}
            onChange={(event) => onChange({ ...value, start_date: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-end`}>{endLabel}</label>
          <input
            id={`${prefix}-end`}
            type="date"
            required={required}
            min={endMinimum}
            max={maximum}
            aria-invalid={reversed || undefined}
            aria-describedby={reversed ? `${prefix}-error` : undefined}
            value={value.end_date}
            onChange={(event) => onChange({ ...value, end_date: event.target.value })}
          />
        </div>
      </div>
      {reversed && (
        <p id={`${prefix}-error`} role="alert" className="form-notice form-notice--error">
          Choose an end date on or after the start date.
        </p>
      )}
    </>
  )
}
