import type { AnnualPlan } from './annualContracts'

export const annualObjectiveLabels = {
  most_days_away: 'Most days away',
  fewer_leave_days: 'Fewer leave days',
  different_dates: 'Different dates',
}
export default function AnnualPlanComparison({
  plans,
  selected,
  onSelect,
  disabled,
}: {
  plans: AnnualPlan[]
  selected: string
  onSelect: (id: string) => void
  disabled: boolean
}) {
  return (
    <>
      <div className="annual-comparison-scroll">
        <table className="annual-comparison" aria-label="Compare whole plans">
          <thead>
            <tr>
              <th scope="col">Whole plan</th>
              {plans.map((plan) => (
                <th scope="col" key={plan.plan_id}>
                  {annualObjectiveLabels[plan.objective]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Days away</th>
              {plans.map((plan) => (
                <td key={plan.plan_id}>{plan.accounting.total_days_away}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Leave used</th>
              {plans.map((plan) => (
                <td key={plan.plan_id}>{plan.accounting.total_leave_used}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Remaining</th>
              {plans.map((plan) => (
                <td key={plan.plan_id}>{plan.accounting.remaining_days}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Breaks included</th>
              {plans.map((plan) => (
                <td key={plan.plan_id}>{plan.breaks.length}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Select</th>
              {plans.map((plan) => (
                <td key={plan.plan_id}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={plan.plan_id === selected}
                    aria-label={`View ${annualObjectiveLabels[plan.objective]}`}
                    onClick={() => onSelect(plan.plan_id)}
                  >
                    {plan.plan_id === selected ? 'Selected' : 'View plan'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        {plans.length === 1
          ? 'No materially different plans found under these rules.'
          : 'Alternative objectives apply among materially different whole plans.'}
      </p>
    </>
  )
}
