import {instanceDocId, refDataset} from '@sanity/workflow-engine'
import {DATASET, DEFINITION, PROJECT_ID, TAG, ai, engine, fieldOf, fired, settled, writeClient} from './engine.ts'

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

// The field trip, after the workflow says "signed": put the drawing on the slip, post, report back.
// Everything it needs was recorded with the decision, and every step is idempotent (setIfMissing, a post id
// derived from the slip, report only if not yet recorded), so if any step fails, running it again finishes the job.
// It succeeds only when the instance has actually reached "filed"; any other outcome throws, and a retry resumes.
export async function haikuFieldTrip(instanceId: string, slipId: string, io: {engine: Pick<typeof engine, 'tick' | 'getInstance' | 'fireAction'>; client: Pick<typeof writeClient, 'patch' | 'getDocument' | 'createIfNotExists'>} = {engine, client: writeClient}) {
  const postId = `wall-${slipId}`
  const instance = await settled(instanceId, io.engine)
  if (instance.currentStage === 'filed') return postId
  if (instance.currentStage !== 'signed') throw new Error(`slip is ${instance.currentStage}, not signed`)
  const asset = (fieldOf(instance, 'guardianSignature') as {asset?: string} | undefined)?.asset
  if (asset) {
    const signedAt = instance.history?.find((h) => h._type === 'actionFired' && h.action === 'sign')?.at ?? new Date().toISOString()
    await io.client.patch(slipId).setIfMissing({signature: {_type: 'object', image: {_type: 'image', asset: {_type: 'reference', _ref: asset}}, name: fieldOf(instance, 'guardianName'), signedAt}}).commit()
  }
  const slip = await io.client.getDocument<{payload: string}>(slipId)
  await io.client.createIfNotExists({
    _id: postId,
    _type: 'wallPost',
    text: slip!.payload,
    agent: {_type: 'reference', _ref: DEMO_AGENT._id},
    slip: {_type: 'reference', _ref: slipId},
    postedAt: new Date().toISOString(),
  })
  if (!fired(instance, 'report')) {
    try {
      await io.engine.fireAction({instanceId, activity: 'field-trip', action: 'report', params: {outcome: `Posted to ${SITE}/#post-${postId}`}})
    } catch {
      // Maybe another finisher reported, maybe nothing did: only the settled state says which.
    }
  }
  const after = await settled(instanceId, io.engine)
  if (after.currentStage !== 'filed') throw new Error(`the field trip is not filed yet (stage ${after.currentStage})`)
  return postId
}
