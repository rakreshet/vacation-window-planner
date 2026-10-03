import { annualFixture } from './annualFixtures'

export function budgetFixture(baselineDays = 18) {
  const baseline = annualFixture()
  baseline.calculation_context.planning.balance_days = baselineDays
  return {
    input: baseline.input,
    baseline_days: baselineDays,
    calculation_context: baseline.calculation_context,
    scenarios: [baselineDays - 1, baselineDays, baselineDays + 1]
      .filter((days) => days >= 3 && days <= 366)
      .map((available_days) => {
        const run = structuredClone(annualFixture())
        const change = available_days - 18
        const plan = run.plans[0]
        plan.accounting.available_days = available_days
        plan.accounting.spendable_days += change
        plan.accounting.remaining_days += change
        plan.accounting.unallocated_days += change
        plan.breaks.forEach((item) => {
          item.balance_after_break += change
        })
        return {
          available_days,
          outcome: {
            input: run.input,
            policy: run.policy,
            status: run.status,
            full_mix_feasibility: run.full_mix_feasibility,
            counters: run.counters,
            limit_reason: run.limit_reason,
            conflicts: run.conflicts,
            locked_assessments: run.locked_assessments,
            year_calendar: run.year_calendar,
            plans: run.plans,
          },
        }
      }),
  }
}
