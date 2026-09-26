import { useState } from 'react'
import type { PlanningDraft } from './planning'
import { annualInput, newAnnualDraft } from './annualDraft'
import PlanningFields from './PlanningFields'
import { createSession } from './api'
import { planningSession } from './planning'
import { generateAnnualPlans } from './annualApi'
import type { AnnualRun } from './annualContracts'
import AnnualPlanResults from './AnnualPlanResults'
import AnnualMixFields from './AnnualMixFields'

export default function AnnualPlanWorkspace({
  initialPlanning,
}: {
  initialPlanning: PlanningDraft
}) {
  const [draft, setDraft] = useState(() => newAnnualDraft(initialPlanning))
  const [result, setResult] = useState<AnnualRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const input = annualInput(draft)
      const token = await createSession(planningSession(draft.planning))
      setResult(await generateAnnualPlans(token, input))
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Annual planning is unavailable. Try again.',
      )
    } finally {
      setBusy(false)
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
        <fieldset disabled={busy}>
          <div className="field-grid">
            <PlanningFields
              annual
              prefix="annual-"
              value={draft.planning}
              onChange={(planning) => setDraft({ ...draft, planning })}
            />
            <label className="field">
              Protected reserve
              <input
                type="number"
                min="0"
                step="1"
                value={draft.reserve}
                onChange={(event) => setDraft({ ...draft, reserve: event.target.value })}
              />
            </label>
          </div>
          <AnnualMixFields draft={draft} onChange={setDraft} />
          <button className="button button--primary" type="submit">
            {busy ? 'Calculating…' : 'Generate plans'}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {result ? (
        <AnnualPlanResults result={result} />
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
