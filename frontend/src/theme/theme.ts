import { themeConfig } from './config'

export function readThemeHue(): number {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(themeConfig.storageKey) ?? 'null')
    if (typeof saved === 'number' && Number.isFinite(saved) && saved >= 0 && saved <= 360) {
      return saved
    }
  } catch {
    // Storage is optional, including in private browsing.
  }
  return themeConfig.defaultHue
}

/** Rotate hue, then preserve source luminance so text contrast survives palette changes. */
export function rotateColor(hex: string, degrees: number): string {
  if (degrees === 0) return hex
  const expanded = hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  const alpha = expanded.length === 9 ? parseInt(expanded.slice(7), 16) / 255 : 1
  const rotatedHue = (hue + degrees + 720) % 360
  const amplitude = saturation * Math.min(lightness, 1 - lightness)
  const rotated = [0, 8, 4].map((offset) => {
    const k = (offset + rotatedHue / 30) % 12
    return lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  })
  const linear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const luminance = (channels: number[]) =>
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  const target = luminance([r, g, b].map(linear))
  const channels = rotated.map(linear)
  const actual = luminance(channels)
  // Blend toward black or white in linear RGB; both keep channels in gamut.
  const corrected = channels.map((channel) => {
    const value =
      actual > target
        ? (channel * target) / actual
        : actual < target
          ? channel + ((1 - channel) * (target - actual)) / (1 - actual)
          : channel
    const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
    return (Math.max(0, Math.min(1, encoded)) * 255).toFixed(6)
  })
  return `rgb(${corrected.join(' ')} / ${alpha})`
}

export function applyTheme(hue: number) {
  const safeHue = Number.isFinite(hue) ? Math.max(0, Math.min(360, hue)) : themeConfig.defaultHue
  for (const [token, color] of Object.entries(themeConfig.colors)) {
    const fixed = (themeConfig.fixedTokens as readonly string[]).includes(token)
    document.documentElement.style.setProperty(
      `--${token}`,
      rotateColor(color, fixed ? 0 : safeHue - themeConfig.baseHue),
    )
  }
}

export function saveTheme(hue: number): boolean {
  try {
    localStorage.setItem(themeConfig.storageKey, JSON.stringify(hue))
    return true
  } catch {
    return false
  }
}
