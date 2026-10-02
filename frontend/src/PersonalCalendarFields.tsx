import type { ReactNode } from 'react'
import { Icon } from './InterfaceArtwork'
import { FieldError, useFieldValidation } from './FieldValidation'
import { useState } from 'react'
import CalendarRuleEditor from './CalendarRuleEditor'
import CalendarRuleList from './CalendarRuleList'
import { applyCalendarRule, removeCalendarRule } from './calendarRules'
import { emptyPersonalCalendar, type PlanningDraft } from './planning'

type PersonalCalendarFieldsProps = {
  value: PlanningDraft
  onChange: (value: PlanningDraft) => void
  children?: ReactNode
}

export default function PersonalCalendarFields({
  value,
  onChange,
  children,
}: PersonalCalendarFieldsProps) {
  const field = useFieldValidation()
  const calendar = value.personalCalendar ?? emptyPersonalCalendar()
  const ruleDraft = value.calendarEditor
  const [error, setError] = useState<string | null>(null)

  function applyRule() {
    if (!ruleDraft) return
    try {
      const personalCalendar = applyCalendarRule(calendar, ruleDraft)
      onChange({ ...value, calendarEditor: undefined, personalCalendar })
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The calendar rule could not be applied')
    }
  }

  return (
    <details className="calendar-disclosure field--wide">
      <summary>
        <Icon name="calendar" />
        <span>
          Personal calendar & exceptions
          <small>
            {ruleDraft
              ? 'Finish or cancel your calendar rule to continue'
              : `${calendar.date_overrides.length + calendar.unavailable_ranges.length} rules · ${calendar.minimum_notice_days} notice days${value.allowedNegative !== '0' ? ` · ${value.allowedNegative} extra leave days allowed` : ''}`}
          </small>
        </span>
        <span className="disclosure-plus" aria-hidden="true">
          +
        </span>
      </summary>
      <fieldset
        className="field field--wide personal-calendar"
        tabIndex={-1}
        {...field('context.personal_calendar')}
      >
        <legend>My calendar</legend>
        {children}
        <FieldError field="context.personal_calendar" />
        <p>
          Personal days off use no leave. Extra working days override holidays and weekends.
          Unavailable dates exclude the entire break.
        </p>
        <label>
          Minimum notice days
          <input
            {...field('context.personal_calendar.minimum_notice_days')}
            type="number"
            min="0"
            max="90"
            step="1"
            value={calendar.minimum_notice_days}
            onChange={(event) =>
              onChange({
                ...value,
                personalCalendar: { ...calendar, minimum_notice_days: Number(event.target.value) },
              })
            }
          />
        </label>
        <FieldError field="context.personal_calendar.minimum_notice_days" />
        <small>Calendar days from today before a break may start.</small>
        <CalendarRuleList
          calendar={calendar}
          editing={!!ruleDraft}
          onEdit={(calendarEditor) => onChange({ ...value, calendarEditor })}
          onRemove={(original) =>
            onChange({ ...value, personalCalendar: removeCalendarRule(calendar, original) })
          }
        />
        {ruleDraft ? (
          <CalendarRuleEditor
            draft={ruleDraft}
            error={error}
            onApply={applyRule}
            onChange={(calendarEditor) => onChange({ ...value, calendarEditor })}
            onCancel={() => {
              setError(null)
              onChange({ ...value, calendarEditor: undefined })
            }}
          />
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
    </details>
  )
}
