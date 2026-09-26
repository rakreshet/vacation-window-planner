import { calendarRuleLabels, type CalendarRuleDraft } from './calendarRules'

type CalendarRuleEditorProps = {
  draft: CalendarRuleDraft
  error: string | null
  onChange: (draft: CalendarRuleDraft) => void
  onApply: () => void
  onCancel: () => void
}

export default function CalendarRuleEditor({
  draft,
  error,
  onChange,
  onApply,
  onCancel,
}: CalendarRuleEditorProps) {
  return (
    <div className="calendar-rule-editor">
      <label>
        Rule type
        <select
          value={draft.kind}
          onChange={(event) => {
            const kind = event.target.value
            if (
              kind === 'personal_day_off' ||
              kind === 'extra_working_day' ||
              kind === 'unavailable'
            )
              onChange({ ...draft, kind })
          }}
        >
          {Object.entries(calendarRuleLabels).map(([kind, label]) => (
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
          value={draft.start_date}
          onChange={(event) => onChange({ ...draft, start_date: event.target.value })}
        />
      </label>
      <label>
        Rule end date
        <input
          type="date"
          value={draft.end_date}
          onChange={(event) => onChange({ ...draft, end_date: event.target.value })}
        />
      </label>
      <p>Apply or cancel this rule before calculating.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={onApply}>
        Apply rule
      </button>
      <button type="button" onClick={onCancel}>
        Cancel rule
      </button>
    </div>
  )
}
