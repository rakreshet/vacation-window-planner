import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { createActionSnapshot } from './actionSnapshots'
import { window, assessment, context } from './snapshotFixtures'
import { SavedOptionsStore, savedOptionPrefix } from './savedOptions'
import { MemoryOptionStorage } from './memoryOptionStorage'
let storage: MemoryOptionStorage

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  storage = new MemoryOptionStorage()
})
afterEach(() => vi.unstubAllGlobals())

test('save survives reload and duplicate save preserves a renamed item', async () => {
  const store = new SavedOptionsStore(storage)
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  expect(store.save(snapshot).status).toBe('saved')
  store.rename(snapshot.capture_id, 'Winter break')
  const reloaded = new SavedOptionsStore(storage)
  expect(reloaded.save(snapshot).status).toBe('already_saved')
  expect(reloaded.list().items[0].name).toBe('Winter break')
  expect(reloaded.list().items[0].snapshot.export_uid).toBe(snapshot.export_uid)
})

test('corrupt and unsupported items are isolated from valid records and oversized writes are rejected', async () => {
  const store = new SavedOptionsStore(storage)
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  store.save(snapshot)
  storage.setItem(savedOptionPrefix + 'broken', '{')
  storage.setItem(savedOptionPrefix + 'future', JSON.stringify({ schema_version: 2 }))
  expect(store.list().items).toHaveLength(1)
  expect(store.list().invalid).toHaveLength(2)
  expect(() => store.rename(snapshot.capture_id, 'a'.repeat(81))).toThrow()
  const oversized = {
    ...snapshot,
    capture_id: 'a'.repeat(64),
    metadata: { explanation: '🌴'.repeat(17000) },
  }
  expect(() => store.save(oversized)).toThrow()
  expect(store.list().items[0].snapshot.capture_id).toBe(snapshot.capture_id)
})

test('bounded saves, quota errors, and removal undo preserve existing records', async () => {
  const store = new SavedOptionsStore(storage)
  const snapshot = await createActionSnapshot('search', window, assessment, context)
  for (let index = 0; index < 50; index++) {
    const id = index.toString(16).padStart(64, '0')
    store.save({ ...snapshot, capture_id: id, export_uid: `${id}@vacation-window-planner` })
  }
  expect(() => store.save(snapshot)).toThrow('50')
  const removed = store.remove('0'.repeat(64))
  expect(store.list().items).toHaveLength(49)
  store.restore(removed)
  expect(store.list().items).toHaveLength(50)
  const failing = new SavedOptionsStore({
    get length() {
      return storage.length
    },
    key: (index) => storage.key(index),
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    setItem: () => {
      throw new Error('Quota exceeded')
    },
  })
  expect(() => failing.rename('0'.repeat(64), 'Changed')).toThrow('Quota')
  expect(store.list().items[0].name).not.toBe('Changed')
})
