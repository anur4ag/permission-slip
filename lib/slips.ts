import {DATASET, PROJECT_ID, TAG, writeClient} from './engine.ts'

export const STAGE_TITLE: Record<string, string> = {
  checks: 'Hall monitor checking',
  'awaiting-signature': 'Awaiting a guardian',
  signed: 'Signed: field trip approved',
  declined: 'Declined',
  expired: 'Expired unsigned',
  filed: 'Filed away',
}
const ACTION_TITLE: Record<string, string> = {run: 'Hall monitor checked the payload', sign: 'A guardian signed', decline: 'A guardian declined', report: 'The agent reported back'}

export type SlipView = {
  _id: string
  title: string
  kind: string
  destination: string
  payload: string
  reason?: string
  reversible?: boolean
  audience?: string
  costUsd?: number
  requestedAt: string
  expiresAt?: string
  agent: {_id: string; name: string; emoji?: string; model?: string; owner?: string}
  signature?: {url?: string; name?: string; signedAt?: string}
  workflow: {instanceId: string; stage: string; fields: Record<string, unknown>; history: {at: string; what: string}[]} | null
}

const SLIP = `_id, title, kind, destination, payload, reason, reversible, audience, costUsd, requestedAt, expiresAt,
  "agent": requestedBy->{_id, name, emoji, model, owner},
  "signature": signature{"url": image.asset->url, name, signedAt}`
// A workflow instance points at its slip through a global document reference in its subject field.
const INSTANCE = `*[_type == "sanity.workflow.instance" && tag == $tag && ("dataset:${PROJECT_ID}:${DATASET}:" + ^._id) in fields[].value.id] | order(_createdAt desc)[0]{_id, currentStage, fields, history}`

// @sanity/client 8 infers params from literal queries; these are built strings, so skip that.
const fetch = <T>(query: string, params: Record<string, unknown>) => writeClient.fetch(query, params as never) as Promise<T>

type RawInstance = {_id: string; currentStage: string; fields?: {name?: string; value?: unknown}[]; history?: {_type: string; at: string; stage?: string; action?: string}[]} | null

// The slip (content) and its workflow instance (process), read side by side in one query.
export async function getSlip(id: string): Promise<SlipView | null> {
  type Row = Omit<SlipView, 'workflow'> & {instance: RawInstance}
  const slip = await fetch<Row | null>(`*[_type == "slip" && _id == $id][0]{${SLIP}, "instance": ${INSTANCE}}`, {id, tag: TAG})
  if (!slip) return null
  const {instance, ...rest} = slip
  return {...rest, workflow: summarise(instance)}
}

export async function recentSlips(limit = 12) {
  type Row = Omit<SlipView, 'workflow'> & {instance: RawInstance}
  const slips = await fetch<Row[]>(`*[_type == "slip" && defined(requestedAt)] | order(requestedAt desc)[0...$limit]{${SLIP}, "instance": ${INSTANCE}}`, {limit, tag: TAG})
  return slips.map(({instance, ...rest}) => ({...rest, workflow: summarise(instance)}))
}

function summarise(inst: RawInstance): SlipView['workflow'] {
  if (!inst) return null
  const fields = Object.fromEntries((inst.fields ?? []).filter((f) => f.name).map((f) => [f.name!, f.value]))
  const history = (inst.history ?? []).flatMap((h) =>
    h._type === 'stageEntered' ? [{at: h.at, what: STAGE_TITLE[h.stage ?? ''] ?? h.stage ?? ''}] : h._type === 'actionFired' && h.action ? [{at: h.at, what: ACTION_TITLE[h.action] ?? h.action}] : [],
  )
  return {instanceId: inst._id, stage: inst.currentStage, fields, history}
}
