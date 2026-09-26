// End-to-end smoke test against the real project: file → hall monitor → sign → field trip → filed.
import {engine} from '../lib/engine.ts'
import {fileHaikuSlip, haikuFieldTrip} from '../lib/demo.ts'

const filed = await fileHaikuSlip(process.argv[2] ?? 'a signed permission slip')
if ('error' in filed) throw new Error(filed.error)
const show = async (label: string) => {
  const i = await engine.getInstance({instanceId: filed.instanceId})
  console.log(label.padEnd(14), i.currentStage, JSON.stringify(Object.fromEntries(((i as unknown as {fields?: {name: string; value?: unknown}[]}).fields ?? []).map((f) => [f.name, f.value]))).slice(0, 300))
}
await show('after filing')
await engine.fireAction({instanceId: filed.instanceId, activity: 'guardian', action: 'sign', params: {name: 'Smoke Test'}})
await show('after sign')
const post = await haikuFieldTrip(filed.instanceId, filed.slipId)
await show('after trip')
console.log('slip', filed.slipId, 'post', post)
