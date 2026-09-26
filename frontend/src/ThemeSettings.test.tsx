import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ThemeSettings from './ThemeSettings'
import { themeConfig } from './theme/config'
import { readThemeHue } from './theme/theme'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('style')
})

test('palette and slider choices survive remounts and reset to the original design', () => {
  const values = new Map<string, string>()
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size
    },
  } as Storage)
  const first = render(<ThemeSettings />)
  const original = document.documentElement.style.getPropertyValue('--accent')
  const danger = document.documentElement.style.getPropertyValue('--danger')
  fireEvent.click(screen.getByText('Appearance'))
  fireEvent.click(screen.getByRole('button', { name: 'Ocean' }))
  expect(document.documentElement.style.getPropertyValue('--accent')).not.toBe(original)
  expect(document.documentElement.style.getPropertyValue('--danger')).toBe(danger)
  fireEvent.change(screen.getByRole('slider'), { target: { value: '123' } })
  first.unmount()
  render(<ThemeSettings />)
  fireEvent.click(screen.getByText('Appearance'))
  expect(screen.getByRole('slider')).toHaveValue('123')
  fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe(original)
  expect(readThemeHue()).toBe(themeConfig.defaultHue)
})

test('invalid or unavailable storage leaves appearance controls usable', () => {
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
    getItem: () => '999',
  } as unknown as Storage)
  expect(readThemeHue()).toBe(themeConfig.defaultHue)
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('blocked')
  })
  render(<ThemeSettings />)
  fireEvent.click(screen.getByText('Appearance'))
  fireEvent.click(screen.getByRole('button', { name: 'Forest' }))
  expect(screen.getByRole('slider')).toHaveValue('145')
  expect(screen.getByText(/storage is unavailable/)).toBeVisible()
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'Escape' })
  expect(screen.getByText('Appearance')).toHaveFocus()
})
