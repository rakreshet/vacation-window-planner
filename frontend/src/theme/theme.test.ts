import { afterEach, expect, test, vi } from 'vitest'
import { applyTheme, readThemeHue } from './theme'
import { themeConfig } from './config'

const root = document.documentElement
const token = (name: string) => root.style.getPropertyValue(`--${name}`)
afterEach(() => {
  root.removeAttribute('style')
  vi.restoreAllMocks()
})

// CSS parses the rendered color independently of the theme's color conversion.
function luminance(color: string) {
  const probe = document.createElement('span')
  probe.style.color = color
  const rgb = getComputedStyle(probe)
    .color.match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number)
  const channels = rgb.map((channel) => {
    const v = channel / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

test('every slider hue retains readable text on the surfaces that actually contain it', () => {
  const pairs = [
    ['accent', 'paper'],
    ['ink', 'canvas'],
    ['focus-ring', 'canvas'],
    ['focus-ring', 'surface-tint'],
    ['brand-ink', 'surface-selected'],
    ['ink-soft', 'assistant-start'],
    ['ink-soft', 'surface-tint'],
  ]
  for (let hue = 0; hue <= 360; hue++) {
    applyTheme(hue)
    for (const [foreground, background] of pairs) {
      const values = [luminance(token(foreground)), luminance(token(background))].sort(
        (a, b) => a - b,
      )
      expect(
        (values[1] + 0.05) / (values[0] + 0.05),
        `${foreground} on ${background}, hue ${hue}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
    expect(token('danger')).toBe('#a23932')
    expect(token('success')).toBe('#2f6757')
  }
})

test.each(['null', '"215"', '{}', '[]', 'true', '-1', '361', 'broken', '1e999'])(
  'malformed saved hue %s falls back to the configured default',
  (saved) => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: () => saved,
    } as unknown as Storage)
    expect(readThemeHue()).toBe(themeConfig.defaultHue)
  },
)
test.each([0, 215, 360])('valid saved hue %i is restored', (hue) => {
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
    getItem: () => String(hue),
  } as unknown as Storage)
  expect(readThemeHue()).toBe(hue)
})
