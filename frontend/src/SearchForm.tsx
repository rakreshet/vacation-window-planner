import { useState } from 'react'
import type { FormEvent } from 'react'

import { createSession, interpretText, searchRecommendations } from './api'
import type { RecommendationResponse } from './api'

type SearchFormProps = {
  onResults: (result: RecommendationResponse, token: string) => void
}

export default function SearchForm({ onResults }: SearchFormProps) {
  const [sourceText, setSourceText] = useState('')
  const [balance, setBalance] = useState('')
  const [allowedNegative, setAllowedNegative] = useState('0')
  const [country, setCountry] = useState('IL')
  const [month, setMonth] = useState('')
  const [preferredLength, setPreferredLength] = useState('')
  const [weekendDays, setWeekendDays] = useState('4,5')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function interpret() {
    if (!sourceText.trim()) {
      setError('Enter a description to interpret')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const proposal = await interpretText(sourceText)
      if (proposal.balance_days !== null) setBalance(String(proposal.balance_days))
      setAllowedNegative(String(proposal.allowed_negative_days))
      if (proposal.country_code !== null) setCountry(proposal.country_code)
      if (proposal.months.length > 0) {
        const selected = proposal.months[0]
        setMonth(`${selected.year}-${String(selected.month).padStart(2, '0')}`)
      }
      if (proposal.preferred_length_days !== null) {
        setPreferredLength(String(proposal.preferred_length_days))
      }
      if (proposal.weekend_days !== null) setWeekendDays(proposal.weekend_days.join(','))
      setMessage('Proposal ready to edit')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Text interpretation failed')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const balanceDays = Number(balance)
    const lengthDays = Number(preferredLength)
    const negativeDays = Number(allowedNegative)
    if (!balance || !month || !preferredLength || !country) {
      setError('Complete all required search fields')
      return
    }
    if (!Number.isInteger(negativeDays) || negativeDays < 0 || negativeDays > 5) {
      setError('Allowed negative days must be a whole number from 0 to 5')
      return
    }
    if (!Number.isInteger(balanceDays) || balanceDays < 0 || !Number.isInteger(lengthDays)) {
      setError('Balance and preferred length must be positive whole days')
      return
    }
    const weekend = weekendDays
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value))
    if (weekend.some((value) => value < 0 || value > 6)) {
      setError('Weekend days must use Monday 0 through Sunday 6')
      return
    }
    const [year, selectedMonth] = month.split('-').map(Number)
    setBusy(true)
    try {
      const token = await createSession({
        balance_days: balanceDays,
        allowed_negative_days: negativeDays,
        country_code: country,
        weekend_days: weekend,
      })
      const result = await searchRecommendations(token, {
        months: [{ year, month: selectedMonth }],
        preferred_length_days: lengthDays,
        result_limit: 5,
        source_text: sourceText.trim() || null,
      })
      onResults(result, token)
      setMessage('Search complete')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="search-heading">
      <h2 id="search-heading">Plan your vacation window</h2>
      <label htmlFor="source-text">Describe your ideal break</label>
      <textarea
        id="source-text"
        value={sourceText}
        onChange={(event) => setSourceText(event.target.value)}
      />
      <button type="button" onClick={() => void interpret()} disabled={busy}>
        Interpret
      </button>

      <form onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="balance">Vacation balance</label>
        <input
          id="balance"
          type="number"
          min="0"
          step="1"
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
        />

        <label htmlFor="allowed-negative">Allowed negative days</label>
        <input
          id="allowed-negative"
          type="number"
          min="0"
          max="5"
          step="1"
          value={allowedNegative}
          onChange={(event) => setAllowedNegative(event.target.value)}
        />

        <label htmlFor="country">Country calendar</label>
        <select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>
          <option value="IL">Israel</option>
        </select>

        <label htmlFor="month">Selected month</label>
        <input
          id="month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />

        <label htmlFor="preferred-length">Preferred length in days</label>
        <input
          id="preferred-length"
          type="number"
          min="1"
          step="1"
          value={preferredLength}
          onChange={(event) => setPreferredLength(event.target.value)}
        />

        <label htmlFor="weekend-days">Weekend override (Monday 0 through Sunday 6)</label>
        <input
          id="weekend-days"
          value={weekendDays}
          onChange={(event) => setWeekendDays(event.target.value)}
        />

        <button type="submit" disabled={busy}>
          Search
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
