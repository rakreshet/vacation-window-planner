import { useId, type ReactNode } from 'react'

export type IconName =
  'compass' | 'calendar' | 'compare' | 'bookmark' | 'arrow' | 'spark' | 'shield' | 'sun'
const paths: Record<IconName, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 5h3m3 0h2" />
    </>
  ),
  compare: (
    <>
      <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />
    </>
  ),
  bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      <path d="M20 2v4m-2-2h4" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
}
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/** Decorative vector landscape; no network assets or layout shifts. */
export function EscapeScene() {
  const id = useId()
  return (
    <svg className="escape-scene" viewBox="0 0 500 320" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--scene-sky-start)" />
          <stop offset="1" stopColor="var(--scene-sky-end)" />
        </linearGradient>
        <linearGradient id={`${id}-water`} x2="500" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--scene-water-start)" />
          <stop offset="1" stopColor="var(--scene-water-end)" />
        </linearGradient>
      </defs>
      <rect width="500" height="320" rx="140" fill={`url(#${id}-sky)`} />
      <circle cx="335" cy="87" r="39" fill="var(--scene-sun)" />
      <path d="m0 224 107-128 92 111 94-67 207 106v74H0Z" fill="var(--scene-mountain-back)" />
      <path d="m0 258 153-116 104 99 119-74 124 65v88H0Z" fill="var(--scene-mountain-front)" />
      <path d="m107 96-29 35 26-6 13 10 12-12Zm46 46-33 25 33-6 23 15Z" fill="var(--scene-snow)" />
      <path d="M0 255c125-26 194 34 272 4s149-18 228 3v58H0Z" fill={`url(#${id}-water)`} />
      <path
        d="M175 278h96m-59 15h111m12-22h68m-311 31h81"
        stroke="var(--scene-water-highlight)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="m410 180-27 75h54Zm-29 23-19 56h38Z" fill="var(--scene-trees)" />
      <path d="M410 240v33m-29-22v23" stroke="var(--scene-trees)" strokeWidth="3" />
      <path
        d="m222 80 8-3 9 3m-46 19 6-2 6 2"
        stroke="var(--scene-birds)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ExampleTicket() {
  return (
    <div className="example-ticket">
      <div className="ticket-top">
        <span>
          <Icon name="sun" /> The art of a longer break
        </span>
        <span className="mini-label">EXAMPLE</span>
      </div>
      <div className="ticket-numbers">
        <div>
          <strong>5</strong>
          <span>leave days</span>
        </div>
        <Icon name="arrow" />
        <div>
          <strong>9</strong>
          <span>days away</span>
        </div>
      </div>
      <div
        className="ticket-days"
        aria-label="Example: two weekend days, five leave days, two weekend days"
      >
        {['S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
          <span key={i} className={i < 2 || i > 6 ? 'free-day' : ''}>
            {day}
          </span>
        ))}
      </div>
      <p>Two weekends. One well-placed pause.</p>
      <small>Illustration only. Your results use your calendar.</small>
    </div>
  )
}
