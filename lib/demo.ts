import {instanceDocId, refDataset} from '@sanity/workflow-engine'
import {DATASET, DEFINITION, PROJECT_ID, TAG, ai, engine, writeClient} from './engine.ts'

// The public demo's agent. It only ever asks to post a haiku on this site's own wall.
export const DEMO_AGENT = {_id: 'agent-haiku-kid', _type: 'agent', name: 'Haiku Kid', handle: {_type: 'slug', current: 'haiku-kid'}, emoji: '🖍️', model: 'Sanity Agent Actions', owner: '@anur4ag', bio: 'Writes one haiku at a time, and always asks before posting it.'}
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const slipRef = (id: string) => refDataset({projectId: PROJECT_ID, dataset: DATASET, documentId: id, type: 'slip'})

export async function writeHaiku(topic: string): Promise<string | null> {
  const r = (await ai.agent.action.prompt({
    instruction: `Write one original haiku (three lines, about 5-7-5 syllables) about: $topic
If the topic asks for anything hateful, sexual, violent, personal or otherwise unkind, do not write it. Respond in JSON only: {"haiku": "line one\\nline two\\nline three"} or {"haiku": null}`,
    instructionParams: {topic: {type: 'constant', value: topic}},
    format: 'json',
    temperature: 0.8,
  })) as {haiku?: string | null}
  return typeof r.haiku === 'string' && r.haiku.trim() ? r.haiku.trim().slice(0, 300) : null
}

// File a slip for a haiku and start its workflow. The hall monitor runs before this returns.
export async function fileHaikuSlip(topic: string) {
  const haiku = await writeHaiku(topic)
  if (!haiku) return {error: 'The Haiku Kid would rather not write about that.'} as const
  await writeClient.createOrReplace(DEMO_AGENT)
  const now = new Date()
  const slip = await writeClient.create({
    _type: 'slip',
    title: 'Post a haiku on the Field Trip Wall',
    kind: 'post',
    destination: `${SITE}/#wall`,
    payload: haiku,
    reason: `A visitor asked for a haiku about "${topic}".`,
    reversible: true,
    audience: 'the-public',
    costUsd: 0,
    requestedBy: {_type: 'reference', _ref: DEMO_AGENT._id},
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 3600_000).toISOString(),
  })
  const instanceId = instanceDocId(TAG)
  await engine.startInstance({definition: DEFINITION, instanceId, initialFields: [{type: 'subject', name: 'subject', value: slipRef(slip._id)}]})
  await engine.drainEffects({instanceId})
  return {slipId: slip._id, instanceId} as const
}

// The field trip: only after the workflow says "signed". Posts, then reports back through the workflow.
export async function haikuFieldTrip(instanceId: string, slipId: string) {
  const instance = await engine.getInstance({instanceId})
  if (instance.currentStage !== 'signed') throw new Error(`slip is ${instance.currentStage}, not signed`)
  const slip = await writeClient.getDocument<{payload: string}>(slipId)
  const post = await writeClient.create({
    _type: 'wallPost',
    text: slip!.payload,
    agent: {_type: 'reference', _ref: DEMO_AGENT._id},
    slip: {_type: 'reference', _ref: slipId},
    postedAt: new Date().toISOString(),
  })
  await engine.fireAction({instanceId, activity: 'field-trip', action: 'report', params: {outcome: `Posted to ${SITE}/#post-${post._id}`}})
  return post._id
}
