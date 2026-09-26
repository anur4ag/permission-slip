import {test} from 'node:test'
import assert from 'node:assert/strict'
import {haikuFieldTrip} from './demo.ts'

// A stand-in for the engine and the Content Lake, with state. Like the real engine, an action and the stage
// transition it enables are separate commits, and tick() commits a pending transition.
// fail: steps that fail once: 'patch' | 'post' | 'report' (before the commit) | 'report-transition' (after the
// report commits, before the stage moves) | 'contention' (ConcurrentFireActionError, nothing committed) |
// 'tick-after-report' (the tick that would file it fails once).
function world(fail: string[] = [], start: {stage?: string; drawing?: object} = {}) {
  const docs = new Map<string, Record<string, unknown>>([['s1', {_id: 's1', payload: 'three short lines'}]])
  const inst = {
    currentStage: start.stage ?? 'signed',
    fields: [{name: 'guardianName', value: 'Ann'}, {name: 'guardianSignature', value: start.drawing ?? {asset: 'image-ann'}}],
    history: [{_type: 'actionFired', action: 'sign', at: '2026-09-26T21:00:00Z'}] as {_type: string; action: string; at: string}[],
  }
  const reports = () => inst.history.filter((h) => h.action === 'report').length
  const once = (name: string) => {
    const i = fail.indexOf(name)
    return i >= 0 && (fail.splice(i, 1), true)
  }
  const engine = {
    tick: async () => {
      if (reports() && inst.currentStage === 'signed' && once('tick-after-report')) throw new Error('tick failed')
      if (inst.currentStage === 'awaiting-signature' && inst.fields.some((f) => f.name === 'guardianName')) inst.currentStage = 'signed'
      if (inst.currentStage === 'signed' && reports()) inst.currentStage = 'filed'
    },
    getInstance: async () => structuredClone(inst),
    fireAction: async () => {
      if (once('report')) throw new Error('report failed')
      if (once('contention')) throw Object.assign(new Error('lost the race three times'), {name: 'ConcurrentFireActionError'})
      if (inst.currentStage !== 'signed' || reports()) throw Object.assign(new Error('not available'), {name: 'ActionDisabledError'})
      inst.history.push({_type: 'actionFired', action: 'report', at: new Date().toISOString()})
      if (once('report-transition')) throw new Error('response lost after the report committed')
      inst.currentStage = 'filed'
    },
  }
  const client = {
    patch: (id: string) => ({setIfMissing: (v: Record<string, unknown>) => ({commit: async () => {
      if (once('patch')) throw new Error('patch failed')
      docs.set(id, {...v, ...docs.get(id)})
    }})}),
    getDocument: async (id: string) => docs.get(id),
    createIfNotExists: async (d: {_id: string}) => {
      if (once('post')) throw new Error('post failed')
      if (!docs.has(d._id)) docs.set(d._id, d)
    },
  }
  const posts = () => [...docs.values()].filter((d) => d._type === 'wallPost')
  return {io: {engine, client} as never, inst, docs, reports, posts}
}

for (const failing of [['patch'], ['post'], ['report'], ['contention'], ['report-transition', 'tick-after-report']]) {
  test(`a field trip interrupted by ${failing.join(' + ')} never claims success, and a retry finishes it once`, async () => {
    const w = world([...failing])
    await assert.rejects(haikuFieldTrip('i1', 's1', w.io))
    assert.notEqual(w.inst.currentStage, 'filed')
    assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1')
    assert.equal(w.inst.currentStage, 'filed')
    assert.equal(w.posts().length, 1)
    assert.equal(w.reports(), 1)
    assert.equal((w.docs.get('s1')!.signature as {image: {asset: {_ref: string}}}).image.asset._ref, 'image-ann')
    assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1') // and again, once filed: nothing new
    assert.equal(w.posts().length, 1)
    assert.equal(w.reports(), 1)
  })
}

test('a report that committed but lost its transition is filed by the same call, with one report', async () => {
  const w = world(['report-transition'])
  assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1')
  assert.equal(w.inst.currentStage, 'filed')
  assert.equal(w.reports(), 1)
})

test('a sign recorded while the move to "signed" is still pending: the trip settles it and finishes', async () => {
  const w = world([], {stage: 'awaiting-signature'})
  assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1')
  assert.equal(w.inst.currentStage, 'filed')
  assert.equal(w.reports(), 1)
})

test('two finishers at once still make one post and one report', async () => {
  const w = world()
  assert.deepEqual(await Promise.all([haikuFieldTrip('i1', 's1', w.io), haikuFieldTrip('i1', 's1', w.io)]), ['wall-s1', 'wall-s1'])
  assert.equal(w.posts().length, 1)
  assert.equal(w.reports(), 1)
})

test('signed without a drawing (Studio, CLI): no drawing written, trip still finishes', async () => {
  const w = world([], {drawing: {}})
  assert.equal(await haikuFieldTrip('i1', 's1', w.io), 'wall-s1')
  assert.equal(w.docs.get('s1')!.signature, undefined)
  assert.equal(w.inst.currentStage, 'filed')
})

test('a drawing already on the slip is never replaced', async () => {
  const w = world()
  w.docs.set('s1', {...w.docs.get('s1'), signature: {name: 'Studio member'}})
  await haikuFieldTrip('i1', 's1', w.io)
  assert.equal((w.docs.get('s1')!.signature as {name: string}).name, 'Studio member')
})
