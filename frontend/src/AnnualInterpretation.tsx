import AnnualReferenceFields, { type AnnualReferenceResolution } from './AnnualReferenceFields'
import { useState } from 'react'
import { annualSlotSchema } from './annualContracts'
import type { AnnualDraft } from './annualDraft'
import { interpretAnnual, type AnnualProposal } from './annualProposal'

export default function AnnualInterpretation({
  draft,
  onChange,
}: {
  draft: AnnualDraft
  onChange: (draft: AnnualDraft) => void
}) {
  const [text, setText] = useState('')
  const [review, setReview] = useState<{ proposal: AnnualProposal; original: AnnualDraft } | null>(
    null,
  )
  const [resolutions, setResolutions] = useState<Record<number, AnnualReferenceResolution>>({})
  const [lockMapping, setLockMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function interpret() {
    setBusy(true)
    setError('')
    setReview(null)
    setLockMapping({})
    setResolutions({})
    try {
      setReview({ proposal: await interpretAnnual(text, draft), original: draft })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Interpretation failed')
    } finally {
      setBusy(false)
    }
  }
  const locks = draft.slots.filter((slot) => slot.dates)
  const mappingComplete =
    !review?.proposal.slots ||
    (locks.every((slot) => Boolean(lockMapping[slot.id])) &&
      new Set(Object.values(lockMapping)).size === locks.length)
  const referencesComplete =
    review?.proposal.references.every((_, index) => {
      const value = resolutions[index]
      return value && value.slot !== '' && value.start_date && value.end_date
    }) ?? false
  function apply() {
    if (
      !review ||
      draft.editingSlotId ||
      review.original !== draft ||
      !mappingComplete ||
      !referencesComplete
    )
      return
    const proposal = review.proposal
    const slots =
      proposal.slots?.map((proposed, index) => {
        const locked = locks.find((slot) => lockMapping[slot.id] === String(index))
        return {
          id: locked?.id ?? crypto.randomUUID(),
          minimum: String(proposed.min_days),
          maximum: String(proposed.max_days),
          dates: locked?.dates ?? proposed.locked_dates,
        }
      }) ?? draft.slots.map((slot) => ({ ...slot }))
    const assigned = new Set<string>()
    for (const resolution of Object.values(resolutions)) {
      const slot = slots[Number(resolution.slot)]
      if (
        !slot ||
        assigned.has(slot.id) ||
        (slot.dates &&
          (slot.dates.start_date !== resolution.start_date ||
            slot.dates.end_date !== resolution.end_date))
      ) {
        setError('Choose a separate slot for each reference and preserve existing locked dates.')
        return
      }
      assigned.add(slot.id)
      slots[Number(resolution.slot)] = {
        ...slot,
        dates: { start_date: resolution.start_date, end_date: resolution.end_date },
      }
    }
    if (
      slots.some(
        (slot) =>
          !annualSlotSchema.safeParse({
            slot_id: slot.id,
            min_days: Number(slot.minimum),
            max_days: Number(slot.maximum),
            locked_dates: slot.dates ?? null,
          }).success,
      )
    ) {
      setError(
        'A locked trip does not fit the proposed range. Discard and edit the mix or request another proposal.',
      )
      return
    }
    onChange({
      ...draft,
      planning: {
        ...draft.planning,
        balance:
          proposal.available_days === undefined
            ? draft.planning.balance
            : String(proposal.available_days),
      },
      year: proposal.year === undefined ? draft.year : String(proposal.year),
      gap: proposal.minimum_gap_days === undefined ? draft.gap : String(proposal.minimum_gap_days),
      slots,
      reserve: proposal.reserve_days === undefined ? draft.reserve : String(proposal.reserve_days),
      months: proposal.allowed_start_months ?? draft.months,
    })
    setReview(null)
  }
  return (
    <section className="annual-interpretation" aria-label="Optional annual interpretation">
      <label className="field">
        Describe your year
        <textarea value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} />
      </label>
      <p>Optional. Interpretation proposes editable fields; it never calculates a plan.</p>
      <button type="button" disabled={busy || !text.trim()} onClick={() => void interpret()}>
        Interpret annual request
      </button>
      {busy && <p role="status">Interpreting…</p>}
      {error && <p role="alert">{error}</p>}
      {review && (
        <section aria-label="Review annual proposal">
          <h2>Review annual proposal</h2>
          {review.proposal.year !== undefined && (
            <p>
              Plan year: {review.original.year} → {review.proposal.year}
            </p>
          )}
          {review.proposal.available_days !== undefined && (
            <p>
              Available leave: {review.original.planning.balance} → {review.proposal.available_days}
            </p>
          )}
          {review.proposal.minimum_gap_days !== undefined && (
            <p>
              Minimum gap: {review.original.gap} → {review.proposal.minimum_gap_days}
            </p>
          )}
          {review.proposal.slots && (
            <>
              <p>
                Requested mix:{' '}
                {review.original.slots
                  .map((slot) => `${slot.minimum}–${slot.maximum} days`)
                  .join(', ')}{' '}
                →{' '}
                {review.proposal.slots
                  .map(
                    (slot) =>
                      `${slot.label}: ${slot.min_days}–${slot.max_days} days${slot.locked_dates ? ` (${slot.locked_dates.start_date} – ${slot.locked_dates.end_date})` : ''}`,
                  )
                  .join(', ')}
              </p>
              {locks.map((slot) => (
                <label className="field" key={slot.id}>
                  Preserve locked Break {draft.slots.indexOf(slot) + 1} in
                  <select
                    value={lockMapping[slot.id] ?? ''}
                    onChange={(event) =>
                      setLockMapping({ ...lockMapping, [slot.id]: event.target.value })
                    }
                  >
                    <option value="">Choose proposed slot explicitly</option>
                    {review.proposal.slots?.map((proposed, index) => (
                      <option key={index} value={index}>
                        Break {index + 1}: {proposed.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </>
          )}
          {review.proposal.reserve_days !== undefined && (
            <p>
              Protected reserve: {review.original.reserve} → {review.proposal.reserve_days}
            </p>
          )}
          {review.proposal.allowed_start_months !== undefined && (
            <p>
              Start months: {review.original.months.join(', ')} →{' '}
              {review.proposal.allowed_start_months.join(', ') || 'none'}
            </p>
          )}
          {review.proposal.references.map((reference, index) => (
            <AnnualReferenceFields
              key={index}
              description={reference.description}
              slots={
                review.proposal.slots?.map((slot) => slot.label) ??
                draft.slots.map((slot) => `${slot.minimum}–${slot.maximum} days`)
              }
              value={resolutions[index] ?? { slot: '', start_date: '', end_date: '' }}
              onChange={(value) => setResolutions({ ...resolutions, [index]: value })}
            />
          ))}
          {review.proposal.assumptions.map((assumption, index) => (
            <p key={index}>{assumption}</p>
          ))}
          {review.original !== draft && (
            <p role="status">
              This proposal is outdated. Interpret again to review your current draft.
            </p>
          )}
          <button
            type="button"
            disabled={
              Boolean(draft.editingSlotId) ||
              review.original !== draft ||
              !mappingComplete ||
              !referencesComplete
            }
            onClick={apply}
          >
            Apply proposal
          </button>
          <button type="button" onClick={() => setReview(null)}>
            Discard proposal
          </button>
        </section>
      )}
    </section>
  )
}
