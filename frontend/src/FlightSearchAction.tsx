import { useEffect, useId, useRef, useState } from 'react'
import type { DateRange } from './api'
import { formatSavedWindow } from './displayDates'

type FlightSelection = { selected: string | null; select: (id: string | null) => void }
type FlightSearchProps = {
  dates: DateRange
  selection: FlightSelection
  disabledReason?: string
  historicalContext?: string
}

export function useFlightSearchSelection(identity: string): FlightSelection {
  const [capture, setCapture] = useState<{ identity: string; selected: string | null }>({
    identity,
    selected: null,
  })
  // Reset only the handoff when its planning context changes; retain the surrounding controls.
  if (capture.identity !== identity) setCapture({ identity, selected: null })
  return {
    selected: capture.identity === identity ? capture.selected : null,
    select: (selected) => setCapture({ identity, selected }),
  }
}

export default function FlightSearchAction({
  dates,
  selection,
  disabledReason,
  historicalContext,
}: FlightSearchProps) {
  const reasonId = useId()
  if (disabledReason)
    return (
      <div className="flight-search-action">
        <button
          type="button"
          className="button button--secondary"
          disabled
          aria-describedby={reasonId}
        >
          Find flights
        </button>
        <p id={reasonId} className="field-hint">
          {disabledReason}
        </p>
      </div>
    )
  return (
    <CurrentFlightSearchAction
      key={`${dates.start_date}:${dates.end_date}`}
      dates={dates}
      selection={selection}
      historicalContext={historicalContext}
    />
  )
}

function googleFlightsUrl(dates: DateRange, departure: string, destination: string): string | null {
  const from = departure.trim()
  const to = destination.trim()
  if (!from || !to) return null
  // Google does not document this query format. Users verify the resulting fields there.
  // Pass local ISO dates unchanged: the inclusive break end is the return departure date.
  const url = new URL('https://www.google.com/travel/flights')
  url.searchParams.set(
    'q',
    `Flights from ${from} to ${to} on ${dates.start_date} returning ${dates.end_date}`,
  )
  url.searchParams.set('hl', 'en')
  return url.href
}

function CurrentFlightSearchAction({ dates, selection, historicalContext }: FlightSearchProps) {
  const [departure, setDeparture] = useState('')
  const [destination, setDestination] = useState('')
  const opener = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  const routeHintId = useId()
  const searchHintId = useId()
  const open = selection.selected === panelId
  const href = googleFlightsUrl(dates, departure, destination)
  useEffect(() => {
    if (open) heading.current?.focus()
  }, [open])
  function close() {
    selection.select(null)
    opener.current?.focus()
  }
  return (
    <div className="flight-search-action">
      <button
        type="button"
        ref={opener}
        className="button button--secondary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => selection.select(panelId)}
      >
        Find flights
      </button>
      {open && (
        <section
          id={panelId}
          className="flight-search-panel"
          aria-label="Find flights for this break"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <div className="flight-search-header">
            <h3 ref={heading} tabIndex={-1}>
              Find flights
            </h3>
            <button
              type="button"
              className="flight-search-close"
              aria-label="Close flight panel"
              onClick={close}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </div>
          <p className="flight-search-dates">{formatSavedWindow(dates)}</p>
          {historicalContext && <p className="form-notice">{historicalContext}</p>}
          <div className="field-grid">
            <label className="field">
              From
              <input
                value={departure}
                placeholder="e.g. TLV"
                aria-required="true"
                aria-describedby={routeHintId}
                onChange={(event) => setDeparture(event.target.value)}
              />
            </label>
            <label className="field">
              To
              <input
                value={destination}
                placeholder="e.g. LAX"
                aria-required="true"
                aria-describedby={routeHintId}
                onChange={(event) => setDestination(event.target.value)}
              />
            </label>
          </div>
          <p id={routeHintId} className="field-hint">
            Enter both cities or airport codes. Use airport codes for specific airports.
          </p>
          {href ? (
            <a
              className="button button--primary flight-search-link"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby={searchHintId}
            >
              Search Google Flights <span>(new tab)</span>
            </a>
          ) : (
            <button
              className="button button--primary"
              type="button"
              disabled
              aria-describedby={routeHintId}
            >
              Search Google Flights <span>(new tab)</span>
            </button>
          )}
          <p id={searchHintId} className="field-hint flight-search-hint">
            Check the airports and dates on Google Flights. If needed, enter them there.
          </p>
        </section>
      )}
    </div>
  )
}
