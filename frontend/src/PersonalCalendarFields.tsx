import { useState } from 'react'
import { emptyPersonalCalendar, type PlanningDraft } from './planning'

const labels = {
  personal_day_off: 'Personal day off',
  extra_working_day: 'Extra working day',
  unavailable: 'Unavailable',
}

export default function PersonalCalendarFields({
  value,
  onChange,
}: {
  value: PlanningDraft
  onChange: (value: PlanningDraft) => void
}) {
  const rules = value.personalCalendar ?? emptyPersonalCalendar()
  const editor = value.calendarEditor
  const [error, setError] = useState<string | null>(null)
  function apply() {
    if (!editor) return
    const updated = {
      ...rules,
      date_overrides: rules.date_overrides.filter(
        (_, index) =>
          !(editor.original && !editor.original.unavailable && editor.original.index === index),
      ),
      unavailable_ranges: rules.unavailable_ranges.filter(
        (_, index) => !(editor.original?.unavailable && editor.original.index === index),
      ),
    }
    if (!editor.start_date || !editor.end_date || editor.end_date < editor.start_date) {
      setError('Choose ordered start and end dates.')
      return
    }
    if (
      (Date.parse(`${editor.end_date}T00:00:00Z`) - Date.parse(`${editor.start_date}T00:00:00Z`)) /
        86400000 >=
      366
    ) {
      setError('A rule may contain at most 366 dates')
      return
    }
    if (
      editor.kind !== 'unavailable' &&
      updated.date_overrides.some(
        (rule) =>
          rule.kind !== editor.kind &&
          rule.start_date <= editor.end_date &&
          editor.start_date <= rule.end_date,
      )
    ) {
      setError('An opposing date override overlaps this rule')
      return
    }
    const range = { start_date: editor.start_date, end_date: editor.end_date }
    onChange({
      ...value,
      calendarEditor: undefined,
      personalCalendar:
        editor.kind === 'unavailable'
          ? { ...updated, unavailable_ranges: [...updated.unavailable_ranges, range] }
          : {
              ...updated,
              date_overrides: [...updated.date_overrides, { ...range, kind: editor.kind }],
            },
    })
    setError(null)
  }
  return (
    <fieldset className="field field--wide personal-calendar">
      <legend>My calendar</legend>
      <p>
        Personal days off use no leave. Extra working days override holidays and weekends.
        Unavailable dates exclude the entire break.
      </p>
      <label>
        Minimum notice days
        <input
          type="number"
          min="0"
          max="90"
          step="1"
          value={rules.minimum_notice_days}
          onChange={(e) =>
            onChange({
              ...value,
              personalCalendar: { ...rules, minimum_notice_days: Number(e.target.value) },
            })
          }
        />
      </label>
      <small>Calendar days from today before a break may start.</small>
      <ul>
        {rules.date_overrides.map((rule, index) => (
          <li key={`${rule.start_date}-${index}`}>
            {rule.start_date} – {rule.end_date} · {labels[rule.kind]}
            <button
              type="button"
              disabled={!!editor}
              aria-label={`Edit ${labels[rule.kind]} ${rule.start_date}`}
              onClick={() =>
                onChange({
                  ...value,
                  calendarEditor: { ...rule, original: { index, unavailable: false } },
                })
              }
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!!editor}
              aria-label={`Remove ${labels[rule.kind]} ${rule.start_date}`}
              onClick={() =>
                onChange({
                  ...value,
                  personalCalendar: {
                    ...rules,
                    date_overrides: rules.date_overrides.filter((_, i) => i !== index),
                  },
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
        {rules.unavailable_ranges.map((rule, index) => (
          <li key={`unavailable-${index}`}>
            {rule.start_date} – {rule.end_date} · Unavailable
            <button
              type="button"
              disabled={!!editor}
              aria-label={`Edit unavailable ${rule.start_date}`}
              onClick={() =>
                onChange({
                  ...value,
                  calendarEditor: {
                    ...rule,
                    kind: 'unavailable',
                    original: { index, unavailable: true },
                  },
                })
              }
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!!editor}
              aria-label={`Remove unavailable ${rule.start_date}`}
              onClick={() =>
                onChange({
                  ...value,
                  personalCalendar: {
                    ...rules,
                    unavailable_ranges: rules.unavailable_ranges.filter((_, i) => i !== index),
                  },
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {editor ? (
        <div className="calendar-rule-editor">
          <label>
            Rule type
            <select
              value={editor.kind}
              onChange={(e) => {
                const kind = e.target.value
                if (
                  kind === 'personal_day_off' ||
                  kind === 'extra_working_day' ||
                  kind === 'unavailable'
                )
                  onChange({ ...value, calendarEditor: { ...editor, kind } })
              }}
            >
              {Object.entries(labels).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rule start date
            <input
              type="date"
              value={editor.start_date}
              onChange={(e) =>
                onChange({ ...value, calendarEditor: { ...editor, start_date: e.target.value } })
              }
            />
          </label>
          <label>
            Rule end date
            <input
              type="date"
              value={editor.end_date}
              onChange={(e) =>
                onChange({ ...value, calendarEditor: { ...editor, end_date: e.target.value } })
              }
            />
          </label>
          <p>Apply or cancel this rule before calculating.</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" onClick={apply}>
            Apply rule
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              onChange({ ...value, calendarEditor: undefined })
            }}
          >
            Cancel rule
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              calendarEditor: { start_date: '', end_date: '', kind: 'personal_day_off' },
            })
          }
        >
          Add calendar rule
        </button>
      )}
    </fieldset>
  )
}
