// How a real agent asks: file a slip for an action it wants to take, then wait for the workflow to say "signed".
// Usage: node --env-file=.env.local scripts/file-slip.ts slip.json   (prints the slip id and instance id)
//        node --env-file=.env.local scripts/file-slip.ts --status <instanceId>
//        node --env-file=.env.local scripts/file-slip.ts --report <instanceId> "<what happened, ideally a link>"
//        node --env-file=.env.local scripts/file-slip.ts --sign <instanceId> "<guardian>"   (a guardian that isn't a person in Studio, e.g. a review pipeline)
//        node --env-file=.env.local scripts/file-slip.ts --decline <instanceId> "<reason>"   (also how the agent withdraws a slip it no longer needs)
// slip.json: {"agent": {"_id", "name", "emoji", "model", "owner"}, "title", "kind", "destination", "payload", "reason", "reversible", "audience", "costUsd", "expiresInHours"}
import {readFileSync} from 'node:fs'
import {instanceDocId} from '@sanity/workflow-engine'
import {DEFINITION, TAG, engine, writeClient} from '../lib/engine.ts'
import {slipRef} from '../lib/demo.ts'

const [flag, a, b] = process.argv.slice(2)
if (flag === '--status') {
  const i = await engine.getInstance({instanceId: a})
  const fields = Object.fromEntries(((i as unknown as {fields?: {name: string; value?: unknown}[]}).fields ?? []).map((f) => [f.name, f.value]))
  console.log(JSON.stringify({stage: i.currentStage, monitor: fields.monitorVerdict, note: fields.monitorNote, signedBy: fields.guardianName ?? null, declined: fields.declineReason ?? null}))
} else if (flag === '--sign') {
  await engine.fireAction({instanceId: a, activity: 'guardian', action: 'sign', params: {name: b}})
  console.log((await engine.getInstance({instanceId: a})).currentStage)
} else if (flag === '--decline') {
  await engine.fireAction({instanceId: a, activity: 'guardian', action: 'decline', params: {reason: b}})
  console.log((await engine.getInstance({instanceId: a})).currentStage)
} else if (flag === '--report') {
  await engine.fireAction({instanceId: a, activity: 'field-trip', action: 'report', params: {outcome: b}})
  console.log((await engine.getInstance({instanceId: a})).currentStage)
} else {
  const s = JSON.parse(readFileSync(flag, 'utf8'))
  await writeClient.createOrReplace({_type: 'agent', handle: {_type: 'slug', current: s.agent._id.replace(/^agent-/, '')}, ...s.agent})
  const now = Date.now()
  const slip = await writeClient.create({
    _type: 'slip', title: s.title, kind: s.kind, destination: s.destination, payload: s.payload, reason: s.reason,
    reversible: !!s.reversible, audience: s.audience, costUsd: s.costUsd ?? 0,
    requestedBy: {_type: 'reference', _ref: s.agent._id},
    requestedAt: new Date(now).toISOString(), expiresAt: new Date(now + (s.expiresInHours ?? 24) * 3600_000).toISOString(),
  })
  const instanceId = instanceDocId(TAG)
  await engine.startInstance({definition: DEFINITION, instanceId, initialFields: [{type: 'subject', name: 'subject', value: slipRef(slip._id)}]})
  await engine.drainEffects({instanceId})
  console.log(JSON.stringify({slipId: slip._id, instanceId, stage: (await engine.getInstance({instanceId})).currentStage}))
}
