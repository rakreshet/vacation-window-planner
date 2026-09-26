import type { PlanningDraft } from './planning'

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function PlanningFields({
  value,
  onChange,
  prefix = '',
}: {
  value: PlanningDraft
  onChange: (value: PlanningDraft) => void
  prefix?: string
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}balance`}>
          Vacation balance <span>Required</span>
        </label>
        <div className="input-with-suffix">
          <input
            id={`${prefix}balance`}
            aria-label="Vacation balance"
            type="number"
            min="0"
            step="1"
            value={value.balance}
            placeholder="8"
            onChange={(e) => onChange({ ...value, balance: e.target.value })}
          />
          <span>days</span>
        </div>
        <small>Available before this break</small>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}allowed-negative`}>Allowed negative days</label>
        <div className="input-with-suffix">
          <input
            id={`${prefix}allowed-negative`}
            type="number"
            min="0"
            max="5"
            step="1"
            value={value.allowedNegative}
            onChange={(e) => onChange({ ...value, allowedNegative: e.target.value })}
          />
          <span>days</span>
        </div>
        <small>How far below zero you will accept</small>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}country`}>Public holiday calendar</label>
        <select
          id={`${prefix}country`}
          aria-label="Country calendar"
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
        >
          <option value="IL">Israel</option>
        </select>
        <small>Observed public holidays</small>
      </div>
      <fieldset className="field field--wide weekend-field">
        <legend>Weekend days</legend>
        <small>Choose the days that are normally free for you</small>
        <div className="day-picker">
          {weekdays.map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                aria-label={day}
                checked={value.weekendDays.includes(index)}
                onChange={() =>
                  onChange({
                    ...value,
                    weekendDays: value.weekendDays.includes(index)
                      ? value.weekendDays.filter((d) => d !== index)
                      : [...value.weekendDays, index].sort(),
                  })
                }
              />
              <span>{day.slice(0, 3)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}
