import Link from 'next/link'
import {notFound} from 'next/navigation'
import {DEMO_AGENT} from '@/lib/demo.ts'
import {publicGuardianCheck} from '@/lib/guardian.ts'
import {STAGE_TITLE, getSlip} from '@/lib/slips.ts'
import {Finish, Guardian, Refresh} from './guardian.tsx'

export const dynamic = 'force-dynamic'

const time = (iso?: string) => (iso ? new Date(iso).toUTCString().slice(5, 22) + ' UTC' : '')

export default async function SlipPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const slip = await getSlip(id)
  if (!slip?.agent) notFound()
  const wf = slip.workflow
  const f = wf?.fields ?? {}
  const refusal = publicGuardianCheck(slip)
  const demo = slip.agent._id === DEMO_AGENT._id
  // A recorded guardian means it's decided, even while the move to "signed" is still pending.
  const decided = !!wf?.fields.guardianName
  const canDecline = demo && wf?.stage === 'awaiting-signature' && !decided
  const stuck = demo && (wf?.stage === 'signed' || (wf?.stage === 'awaiting-signature' && decided))
  return (
    <main>
      <p className="muted">
        <Link href="/">← Permission Slip</Link>
      </p>
      <article className="paper" aria-labelledby="slip-h">
        <div className="row" style={{justifyContent: 'space-between'}}>
          <h1 id="slip-h" style={{fontSize: '1.7rem'}}>Permission slip</h1>
          <span className={`stage ${wf?.stage ?? ''}`}>{wf ? (STAGE_TITLE[wf.stage] ?? wf.stage) : 'no workflow'}</span>
        </div>
        <p className="type muted" style={{margin: 0}}>No. {slip._id.slice(-6).toUpperCase()} · filed {time(slip.requestedAt)}</p>
        <dl className="slip-grid">
          <dt>Agent</dt>
          <dd>
            {slip.agent.emoji} <b>{slip.agent.name}</b> <span className="muted">({slip.agent.model}; owner: {slip.agent.owner})</span>
          </dd>
          <dt>Wants to</dt>
          <dd>
            <b>{slip.kind}</b>: {slip.title}
          </dd>
          <dt>Where</dt>
          <dd>{slip.destination}</dd>
          <dt>Exactly this</dt>
          <dd className={slip.kind === 'post' ? 'hand' : 'exact'}>{slip.payload}</dd>
          <dt>Why</dt>
          <dd>{slip.reason}</dd>
          <dt>Undo</dt>
          <dd>
            {slip.reversible ? 'Reversible' : 'Not reversible'} · audience: {slip.audience} · cost: ${(slip.costUsd ?? 0).toFixed(2)}
          </dd>
          <dt>Expires</dt>
          <dd>{time(slip.expiresAt) || 'never'}</dd>
          <dt>Hall monitor</dt>
          <dd>
            {f.monitorVerdict ? (
              <div className={`monitor ${f.monitorVerdict}`}>
                {f.monitorVerdict === 'pass' ? '✓ Pass' : '⚑ Flagged'}: {String(f.monitorNote ?? '')}
              </div>
            ) : wf?.stage === 'checks' ? (
              'Checking…'
            ) : (
              <span className="muted">No verdict recorded.</span>
            )}
          </dd>
        </dl>
        <hr className="tear" />
        {wf?.stage === 'awaiting-signature' && !refusal && <Guardian slipId={slip._id} />}
        {wf?.stage === 'awaiting-signature' && refusal && <p className="muted">{refusal}</p>}
        {canDecline && refusal && <Guardian slipId={slip._id} declineOnly />}
        {stuck && <Finish slipId={slip._id} />}
        {slip.signature?.url && (
          <div className="row">
            <img src={`${slip.signature.url}?h=120`} alt={`Signature of ${slip.signature.name}`} style={{height: 60}} />
            <span className="muted">
              Signed by {slip.signature.name}, {time(slip.signature.signedAt)}
            </span>
          </div>
        )}
        {f.declineReason ? <p className="error">Declined: {String(f.declineReason)}</p> : null}
        {f.outcome ? <p>Field trip report: {String(f.outcome).replace(/^Posted to /, '')}</p> : null}
        {wf?.stage === 'checks' && <Refresh />}
      </article>

      {wf && (
        <section className="paper" aria-labelledby="hist">
          <h2 id="hist">What happened</h2>
          <p className="muted">
            From the workflow instance <code>{wf.instanceId}</code>: every step is a transition the engine recorded.
          </p>
          <ol className="history">
            {wf.history.map((h, i) => (
              <li key={i}>
                <time dateTime={h.at}>{new Date(h.at).toISOString().slice(11, 19)}</time>
                <span>{h.what}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  )
}
