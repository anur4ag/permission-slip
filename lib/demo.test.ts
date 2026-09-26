import {test} from 'node:test'
import assert from 'node:assert/strict'
import {haikuFieldTrip} from './demo.ts'

// A stand-in for the engine and the Content Lake, with state, that can fail any step once.
function world(fail: string[] = []) {
  const docs = new Map<string, Record<string, unknown>>([['s1', {_id: 's1', payload: 'three short lines'}]])
  const inst = {
    currentStage: 'signed',
    fields: [{name: 'guardianName', value: 'Ann'}, {name: 'guardianSignature', value: 'image-ann'}],
    history: [{_type: 'actionFired', action: 'sign', at: '2026-09-26T21:00:00Z'}],
  }
  const reports: unknown[] = []
  const step = async (name: string) => {
    const i = fail.indexOf(name)
    if (i >= 0) fail.splice(i, 1), await Promise.reject(new Error(`${name} failed`))
  }
  const engine = {
    getInstance: async () => structuredClone(inst),
    fireAction: async (a: {params: unknown}) => {
      await step('report')
      if (inst.currentStage !== 'signed') throw Object.assign(new Error('not available'), {name: 'ActionDisabledError'})
      inst.currentStage = 'filed'
      reports.push(a.params)
    },
  }
  const client = {
    patch: (id: string) => ({setIfMissing: (v: Record<string, unknown>) => ({commit: async () => {
      await step('patch')
      docs.set(id, {...v, ...docs.get(id)})
    }})}),
    getDocument: async (id: string) => docs.get(id),
    createIfNotExists: async (d: {_id: string}) => {
      await step('post')
      if (!docs.has(d._id)) docs.set(d._id, d)
    },
  }
  const posts = () => [...docs.values()].filter((d) => d._type === 'wallPost')
  return {io: {engine, client} as never, inst, docs, reports, posts}
}

for (const failing of ['patch', 'post', 'report']) {
  test(`a field trip interrupted at "${failing}" finishes on retry: one post, one report, the signer's drawing`, async () => {
    const w = world([failing])
    await assert.rejects(haikuFieldTrip('i1', 's1', w.io), new RegExp(`${failing} failed`))
    assert.equal(w.inst.currentStage, 'signed') // still signed: nobody else can sign it now
    assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1')
    assert.equal(w.posts().length, 1)
    assert.equal(w.reports.length, 1)
    assert.equal(w.inst.currentStage, 'filed')
    assert.deepEqual((w.docs.get('s1')!.signature as {name: string; image: {asset: {_ref: string}}}).image.asset._ref, 'image-ann')
    assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1') // and again, once filed: nothing new
    assert.equal(w.posts().length, 1)
  })
}

test('two finishers at once still make one post and one report', async () => {
  const w = world()
  assert.deepEqual(await Promise.all([haikuFieldTrip('i1', 's1', w.io), haikuFieldTrip('i1', 's1', w.io)]), ['wall-s1', 'wall-s1'])
  assert.equal(w.posts().length, 1)
  assert.equal(w.reports.length, 1)
})

test('a drawing already on the slip is never replaced', async () => {
  const w = world()
  w.docs.set('s1', {...w.docs.get('s1'), signature: {name: 'Studio member'}})
  await haikuFieldTrip('i1', 's1', w.io)
  assert.equal((w.docs.get('s1')!.signature as {name: string}).name, 'Studio member')
})
