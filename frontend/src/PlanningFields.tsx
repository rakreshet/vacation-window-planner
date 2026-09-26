import { changePlanningCountry, type PlanningDraft } from './planning'

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
          aria-describedby={`${prefix}calendar-scope`}
          value={value.country}
          onChange={(e) => onChange(changePlanningCountry(value, e.target.value))}
        >
          <option value="IL">Israel</option>
          <option value="US">United States — federal holidays</option>
          <option value="GB">England &amp; Wales — bank holidays</option>
        </select>
        <small id={`${prefix}calendar-scope`}>
          {value.country === 'US'
            ? 'Federal holidays with observed dates; state and employer holidays may differ.'
            : value.country === 'GB'
              ? 'Bank holidays for England & Wales, including substitute days.'
              : 'Observed public holidays'}
        </small>
      </div>
      <fieldset className="field field--wide weekend-field">
        <legend>Weekend days</legend>
        <small>
          Choose the days that are normally free for you. Usual weekends follow the calendar; custom
          selections are kept.
        </small>
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
