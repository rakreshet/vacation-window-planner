import { SavedOptionsStore } from './savedOptions'
export const savedOptionsChanged = 'vacation-window:saved-changed'
export function browserSavedOptions() {
  return new SavedOptionsStore(window.localStorage)
}
export function notifySavedOptionsChanged() {
  window.dispatchEvent(new Event(savedOptionsChanged))
}
