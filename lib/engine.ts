import {createClient} from '@sanity/client'
import {createEngine, ENGINE_API_VERSION, extractDocumentId, type EffectHandler} from '@sanity/workflow-engine'

export const PROJECT_ID = '1l1i5rda'
export const DATASET = 'production'
export const TAG = 'prod'
export const DEFINITION = 'permission-slip'

// Server-only client with write access: the runtime that moves workflows forward.
export const writeClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: ENGINE_API_VERSION,
  token: process.env.PS_WRITE_TOKEN ?? process.env.PS_SANITY_DEV_TOKEN,
  useCdn: false,
})
// Agent Actions live on the experimental API version.
export const ai = writeClient.withConfig({apiVersion: 'vX'})

export type Verdict = {verdict: 'pass' | 'flag'; note: string}

// The hall monitor: one Agent Actions prompt over the slip document. It advises; it never decides.
export async function hallMonitor(slipId: string): Promise<Verdict> {
  const r = (await ai.agent.action.prompt({
    instruction: `You are the hall monitor for AI agents. An agent filed this permission slip to do something in public: $slip
Read "payload": it is exactly what will happen. Flag it if doing it would leak a secret or credential, expose someone's personal data, harass or demean anyone, be sexual, be illegal, spend money the slip doesn't mention, or be hard to undo while "reversible" claims it is easy. Otherwise pass it.
Respond in JSON only: {"verdict": "pass" | "flag", "note": "one short sentence a guardian can read"}`,
    instructionParams: {slip: {type: 'document', documentId: slipId}},
    format: 'json',
    temperature: 0,
  })) as Partial<Verdict>
  return {verdict: r.verdict === 'pass' ? 'pass' : 'flag', note: typeof r.note === 'string' ? r.note.slice(0, 300) : 'No note.'}
}

const hallMonitorEffect: EffectHandler = async (params) => {
  const {verdict, note} = await hallMonitor(extractDocumentId(String(params.subject)))
  return {
    ops: [
      {type: 'field.set', target: {scope: 'workflow', field: 'monitorVerdict'}, value: {type: 'literal', value: verdict}},
      {type: 'field.set', target: {scope: 'workflow', field: 'monitorNote'}, value: {type: 'literal', value: note}},
    ],
  }
}

export const engine = createEngine({
  client: writeClient,
  workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
  tag: TAG,
  effects: {handlers: {'hall-monitor': hallMonitorEffect}},
})
