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

function CurrentFlightSearchAction({ dates, selection, historicalContext }: FlightSearchProps) {
  const [departure, setDeparture] = useState('')
  const [destination, setDestination] = useState('')
  const [message, setMessage] = useState('')
  const copyRevision = useRef(0)
  const summary = useRef<HTMLTextAreaElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  const open = selection.selected === panelId
  useEffect(() => {
    if (open) heading.current?.focus()
  }, [open])
  function close() {
    clearCopy()
    selection.select(null)
    opener.current?.focus()
  }
  function clearCopy() {
    copyRevision.current += 1
    setMessage('')
  }
  const text = [
    'Vacation break',
    `Start date: ${dates.start_date}`,
    `End date: ${dates.end_date}`,
    'Dates include both start and end days.',
    `Departure: ${departure.trim() || 'Not entered'}`,
    `Destination: ${destination.trim() || 'Not entered'}`,
    ...(historicalContext ? [historicalContext] : []),
  ].join('\n')
  async function copy() {
    const revision = ++copyRevision.current
    const field = summary.current
    try {
      await navigator.clipboard.writeText(text)
      if (revision !== copyRevision.current || summary.current !== field) return
      setMessage('Travel details copied')
    } catch {
      if (revision !== copyRevision.current || summary.current !== field) return
      setMessage('Clipboard unavailable. Select the travel details and copy them manually.')
      summary.current?.focus()
      summary.current?.select()
    }
  }
  return (
    <div className="flight-search-action">
      <button
        type="button"
        ref={opener}
        className="button button--secondary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          clearCopy()
          selection.select(panelId)
        }}
      >
        Find flights
      </button>
      {open && (
        <section
          id={panelId}
          className="copy-preview flight-search-panel"
          aria-label="Find flights for this break"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <h3 ref={heading} tabIndex={-1}>
            Find flights for this break
          </h3>
          <p>{formatSavedWindow(dates)} · inclusive local dates</p>
          {historicalContext && <p className="form-notice">{historicalContext}</p>}
          <div className="field-grid">
            <label className="field">
              Departure city or airport (optional)
              <input
                value={departure}
                onChange={(event) => {
                  clearCopy()
                  setDeparture(event.target.value)
                }}
              />
            </label>
            <label className="field">
              Destination (optional)
              <input
                value={destination}
                onChange={(event) => {
                  clearCopy()
                  setDestination(event.target.value)
                }}
              />
            </label>
          </div>
          <label className="field">
            Travel details
            <textarea ref={summary} value={text} readOnly rows={7} />
          </label>
          <p>
            Enter the copied details on Google Flights. The search is not automatically filled in.
            Flight prices, availability and booking are on Google Flights.
          </p>
          <div className="flight-search-controls">
            <button className="button button--secondary" type="button" onClick={() => void copy()}>
              Copy travel details
            </button>
            <a
              className="button button--primary"
              href="https://www.google.com/travel/flights"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Google Flights <span>(new tab)</span>
            </a>
            <button className="button button--secondary" type="button" onClick={close}>
              Close flight panel
            </button>
          </div>
          <p role="status">{message}</p>
        </section>
      )}
    </div>
  )
}
