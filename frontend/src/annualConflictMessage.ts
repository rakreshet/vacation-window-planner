import type { AnnualConflict } from './annualContracts'

export function annualConflictMessage(conflict: AnnualConflict): string {
  switch (conflict.code) {
    case 'locked_budget':
      return `Locked trips use ${conflict.required_days} days; only ${conflict.permitted_days} are available after reserve.`
    case 'mix_budget':
      return `The full mix needs at least ${conflict.required_days} leave days; ${conflict.permitted_days} are available after reserve.`
    case 'locked_overlap':
      return 'Locked dates overlap. Edit or remove one of the affected breaks.'
    case 'locked_unavailable':
      return `Locked dates intersect unavailable dates: ${conflict.dates.join(', ')}.`
    case 'locked_spacing':
      return `Locked trips have ${conflict.gap_days} intervening dates and ${conflict.working_dates_between} working dates; they need at least ${conflict.minimum_gap_days} intervening dates and one working date.`
    case 'mix_constraints':
      return 'The full mix cannot fit these combined calendar, length and spacing constraints.'
  }
}
