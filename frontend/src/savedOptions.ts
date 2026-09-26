import { savedOptionSchema } from './snapshotSchema'
import type { ActionSnapshot } from './actionSnapshots'

export const savedOptionPrefix = 'vacation-window:saved:v1:'
export type SavedOption = {
  schema_version: 1
  name: string
  saved_at: string
  snapshot: ActionSnapshot
}
export type SavedOptionsList = { items: SavedOption[]; invalid: string[] }
export type OptionStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>

export class SavedOptionsStore {
  constructor(private readonly storage: OptionStorage) {}

  list(): SavedOptionsList {
    const items: SavedOption[] = []
    const invalid: string[] = []
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index)
      if (!key?.startsWith(savedOptionPrefix)) continue
      try {
        const raw = this.storage.getItem(key) ?? ''
        if (new TextEncoder().encode(raw).length > 65536) throw new Error('Oversized saved option')
        const item = savedOptionSchema.parse(JSON.parse(raw))
        if (key !== savedOptionPrefix + item.snapshot.capture_id)
          throw new Error('Invalid identity')
        items.push(item)
      } catch {
        invalid.push(key)
      }
    }
    return { items, invalid }
  }

  save(snapshot: ActionSnapshot) {
    const key = savedOptionPrefix + snapshot.capture_id
    if (this.storage.getItem(key)) {
      savedOptionSchema.parse(JSON.parse(this.storage.getItem(key)!))
      return { status: 'already_saved' as const }
    }
    this.checkCapacity()
    this.write(key, {
      schema_version: 1,
      name: `${snapshot.window.start_date} – ${snapshot.window.end_date}`,
      saved_at: new Date().toISOString(),
      snapshot,
    })
    return { status: 'saved' as const }
  }

  private checkCapacity() {
    const { items, invalid } = this.list()
    if (items.length + invalid.length >= 50)
      throw new Error('You can save up to 50 options. Remove one first.')
  }

  remove(id: string) {
    const key = id.startsWith(savedOptionPrefix) ? id : savedOptionPrefix + id
    const raw = this.storage.getItem(key)
    this.storage.removeItem(key)
    return { key, raw }
  }

  restore(removed: { key: string; raw: string | null }) {
    if (removed.raw === null) return
    if (this.storage.getItem(removed.key))
      throw new Error('This option was changed in another tab. Reload to view it.')
    this.checkCapacity()
    this.storage.setItem(removed.key, removed.raw)
  }

  private write(key: string, item: SavedOption) {
    const serialized = JSON.stringify(savedOptionSchema.parse(item))
    if (new TextEncoder().encode(serialized).length > 65536)
      throw new Error('This option exceeds the 64 KiB save limit. You can still export or copy it.')
    this.storage.setItem(key, serialized)
  }

  rename(id: string, name: string) {
    const key = savedOptionPrefix + id
    const item = savedOptionSchema.parse(JSON.parse(this.storage.getItem(key) ?? ''))
    this.write(key, { ...item, name })
  }
}
