import type { AnnualPlan } from './annualContracts'

export default function AnnualPlanChanges({
  previous,
  current,
}: {
  previous: AnnualPlan
  current: AnnualPlan
}) {
  const unchanged =
    current.breaks.length === previous.breaks.length &&
    current.breaks.every((item) => {
      const before = previous.breaks.find((entry) => entry.slot_id === item.slot_id)
      return (
        before &&
        before.window.start_date === item.window.start_date &&
        before.window.end_date === item.window.end_date
      )
    })
  const costChange = current.accounting.total_leave_used - previous.accounting.total_leave_used
  return (
    <section aria-label="Changes since previous calculation">
      <p>
        {unchanged ? 'Dates unchanged' : 'Dates changed'};{' '}
        {costChange === 0
          ? 'leave cost unchanged'
          : `${Math.abs(costChange)} ${costChange > 0 ? 'more' : 'fewer'} leave days used`}
      </p>
      {!unchanged && (
        <ul>
          {current.breaks.map((item) => {
            const before = previous.breaks.find((entry) => entry.slot_id === item.slot_id)
            return (
              <li key={item.slot_id}>
                {before ? `${before.window.start_date} – ${before.window.end_date}` : 'New break'} →{' '}
                {item.window.start_date} – {item.window.end_date}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
