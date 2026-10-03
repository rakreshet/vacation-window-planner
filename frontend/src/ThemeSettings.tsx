import { useEffect, useRef, useState } from 'react'
import { themeConfig } from './theme/config'
import { applyTheme, readThemeHue, rotateColor, saveTheme } from './theme/theme'
import { PanelCloseButton } from './ActionButton'

export default function ThemeSettings() {
  const [hue, setHue] = useState(readThemeHue)
  const [saved, setSaved] = useState(true)
  const disclosure = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    applyTheme(hue)
  }, [hue])
  function change(next: number) {
    setHue(next)
    setSaved(saveTheme(next))
  }
  function close() {
    if (disclosure.current) {
      disclosure.current.open = false
      disclosure.current.querySelector('summary')?.focus()
    }
  }
  const name = themeConfig.presets.find((preset) => preset.hue === hue)?.name ?? 'Custom'
  return (
    <details
      className="theme-settings"
      ref={disclosure}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
      }}
    >
      <summary>
        <span className="theme-current-swatch" aria-hidden="true" />
        Appearance<span>Customize</span>
      </summary>
      <section className="theme-panel" aria-labelledby="theme-heading">
        <div className="theme-panel-heading">
          <div>
            <p className="eyebrow">MAKE IT YOURS</p>
            <h2 id="theme-heading">A different shade of escape.</h2>
          </div>
          <PanelCloseButton label="Close appearance settings" onClick={close} />
        </div>
        <p>The same calm workspace, in your colors.</p>
        <div className="theme-presets" role="group" aria-label="Color palettes">
          {themeConfig.presets.map((preset) => (
            <button
              type="button"
              key={preset.name}
              aria-pressed={hue === preset.hue}
              onClick={() => change(preset.hue)}
            >
              <span
                aria-hidden="true"
                style={{
                  background: rotateColor(
                    themeConfig.colors.accent,
                    preset.hue - themeConfig.baseHue,
                  ),
                }}
              />
              {preset.name}
            </button>
          ))}
        </div>
        <div className="theme-slider-label">
          <label htmlFor="theme-hue">Fine-tune the hue</label>
          <span aria-hidden="true">
            {name} · {hue}°
          </span>
        </div>
        <input
          id="theme-hue"
          type="range"
          min="0"
          max="360"
          step="1"
          value={hue}
          aria-valuetext={`${name}, ${hue} degrees`}
          onChange={(event) => change(Number(event.target.value))}
        />
        <div className="theme-preview" aria-label="Theme preview">
          <span className="theme-preview-tag">YOUR NEXT BREAK</span>
          <strong>A little more time away.</strong>
          <span className="theme-preview-action">Find my dates →</span>
        </div>
        <div className="theme-footer">
          <small>
            {saved
              ? 'Saved automatically in this browser.'
              : 'Preview active. Browser storage is unavailable.'}
          </small>
          <button type="button" onClick={() => change(themeConfig.defaultHue)}>
            Reset to default
          </button>
        </div>
      </section>
    </details>
  )
}
