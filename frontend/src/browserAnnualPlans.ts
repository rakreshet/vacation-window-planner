import { SavedAnnualPlansStore } from './savedAnnualPlans'
export const annualPlansChanged = 'vacation-window:annual-changed'
export function browserAnnualPlans() {
  return new SavedAnnualPlansStore(window.localStorage)
}
export function notifyAnnualPlansChanged() {
  window.dispatchEvent(new Event(annualPlansChanged))
}
