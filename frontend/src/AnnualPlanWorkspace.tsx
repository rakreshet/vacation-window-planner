import { useEffect, useRef, useState } from 'react'
import type { PlanningDraft } from './planning'
import { annualInput, newAnnualDraft, type AnnualDraft } from './annualDraft'
import PlanningFields from './PlanningFields'
import { createSession } from './api'
import { planningSession } from './planning'
import { generateAnnualPlans } from './annualApi'
import type { AnnualBreak, AnnualPlan, AnnualRun } from './annualContracts'
import AnnualPlanResults from './AnnualPlanResults'
import AnnualMixFields from './AnnualMixFields'

export default function AnnualPlanWorkspace({
  initialPlanning,
}: {
  initialPlanning: PlanningDraft
}) {
  const [draft, setDraft] = useState(() => newAnnualDraft(initialPlanning))
  const [result, setResult] = useState<AnnualRun | null>(null)
  const [failedOutcome, setFailedOutcome] = useState<AnnualRun | null>(null)
  const revision = useRef(0)
  const active = useRef<AbortController | null>(null)
  const [calculatedRevision, setCalculatedRevision] = useState(-1)
  useEffect(() => () => active.current?.abort(), [])
  function edit(next: AnnualDraft) {
    revision.current += 1
    active.current?.abort()
    active.current = null
    setBusy(false)
    setError(null)
    setFailedOutcome(null)
    setDraft(next)
  }
  const [selectedId, setSelectedId] = useState('')
  const [previousPlan, setPreviousPlan] = useState<AnnualPlan | null>(null)
  const [notice, setNotice] = useState('')
  const stale = Boolean(result && calculatedRevision !== revision.current)
  function lockDates(item: AnnualBreak) {
    edit({
      ...draft,
      slots: draft.slots.map((slot) =>
        slot.id === item.slot_id
          ? {
              ...slot,
              dates: { start_date: item.window.start_date, end_date: item.window.end_date },
            }
          : slot,
      ),
    })
    setNotice('Dates locked; recalculate to update the other breaks')
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function generate() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const submittedRevision = revision.current
    setBusy(true)
    setError(null)
    try {
      const input = annualInput(draft)
      const token = await createSession(planningSession(draft.planning))
      if (controller.signal.aborted) return
      const next = await generateAnnualPlans(token, input, controller.signal)
      if (controller.signal.aborted || submittedRevision !== revision.current) return
      if (next.plans.length === 0 && result?.plans.length) {
        setFailedOutcome(next)
        setCalculatedRevision(-1)
        return
      }
      setFailedOutcome(null)
      setPreviousPlan(result?.plans.find((plan) => plan.plan_id === selectedId) ?? null)
      setResult(next)
      setSelectedId(next.plans[0]?.plan_id ?? '')
      setCalculatedRevision(submittedRevision)
      setNotice('')
    } catch (caught) {
      if (controller.signal.aborted || submittedRevision !== revision.current) return
      setCalculatedRevision(-1)
      setError(
        caught instanceof Error ? caught.message : 'Annual planning is unavailable. Try again.',
      )
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }
  return (
    <section className="planner-card annual-workspace" aria-labelledby="annual-heading">
      <header className="planner-heading">
        <div>
          <p className="section-kicker">Several breaks. One leave budget.</p>
          <h1 id="annual-heading" tabIndex={-1}>
            Plan my year
          </h1>
        </div>
        <p>Include every future trip in your available leave, including dates already arranged.</p>
      </header>
      {initialPlanning.allowedNegative !== '0' && (
        <p>Annual planning uses zero allowed negative days.</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void generate()
        }}
      >
        <fieldset>
          <div className="field-grid">
            <PlanningFields
              annual
              prefix="annual-"
              value={draft.planning}
              onChange={(planning) => edit({ ...draft, planning })}
            />
            <label className="field">
              Protected reserve
              <input
                type="number"
                min="0"
                step="1"
                value={draft.reserve}
                onChange={(event) => edit({ ...draft, reserve: event.target.value })}
              />
            </label>
          </div>
          <AnnualMixFields draft={draft} onChange={edit} />
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? 'Calculating…' : result ? 'Recalculate plans' : 'Generate plans'}
          </button>
        </fieldset>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {failedOutcome && <AnnualPlanResults result={failedOutcome} />}
      {result ? (
        <AnnualPlanResults
          result={result}
          stale={stale}
          busy={busy}
          previousPlan={previousPlan}
          onLock={lockDates}
          onUseReduced={(plan) =>
            edit({
              ...draft,
              slots: draft.slots.filter((slot) => plan.retained_slot_ids.includes(slot.id)),
            })
          }
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : (
        <aside className="annual-results">
          <h2>Your year, planned together</h2>
          <p>
            Choose your breaks and protect a reserve. Generate plans to see dates that work together
            under one calendar and one leave budget.
          </p>
          <p>
            Include allocated leave for any locked trips even if your HR balance already excludes
            it.
          </p>
        </aside>
      )}
    </section>
  )
}
