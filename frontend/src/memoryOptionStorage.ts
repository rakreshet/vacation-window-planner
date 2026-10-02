import type { OptionStorage } from './savedOptions'
export class MemoryOptionStorage implements OptionStorage {
  clear() {
    this.values.clear()
  }
  private readonly values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}
