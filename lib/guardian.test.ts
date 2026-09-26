import {test} from 'node:test'
import assert from 'node:assert/strict'
import {publicGuardianCheck} from './guardian.ts'
import type {SlipView} from './slips.ts'

const slip = (over: Partial<SlipView> & {stage?: string; verdict?: string}): SlipView => ({
  _id: 's', title: 't', kind: 'post', destination: 'd', payload: 'p', requestedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z',
  agent: {_id: 'agent-haiku-kid', name: 'Haiku Kid'},
  workflow: {instanceId: 'i', stage: over.stage ?? 'awaiting-signature', fields: {monitorVerdict: over.verdict ?? 'pass'}, history: []},
  ...over,
})

test('a visitor may sign only the demo agent\'s clean slips that await a guardian', () => {
  assert.equal(publicGuardianCheck(slip({})), null)
  assert.match(publicGuardianCheck(slip({verdict: 'flag'}))!, /flagged/)
  assert.match(publicGuardianCheck(slip({stage: 'signed'}))!, /not awaiting/)
  assert.match(publicGuardianCheck(slip({agent: {_id: 'agent-claude', name: 'Claude Code'}}))!, /Only the demo agent/)
  assert.equal(publicGuardianCheck(null), 'No such slip.')
  // Signed, with the move to "signed" still pending: decided, so nobody else may sign.
  const pending = slip({})
  pending.workflow!.fields.guardianName = 'Ann'
  assert.match(publicGuardianCheck(pending)!, /already signed/)
})

test('an expired slip cannot be signed even before the engine moves it to "expired"', () => {
  assert.match(publicGuardianCheck(slip({expiresAt: '2026-09-26T20:00:00Z'}), Date.parse('2026-09-26T20:00:01Z'))!, /expired/)
  assert.match(publicGuardianCheck(slip({expiresAt: undefined}))!, /expired/)
  assert.equal(publicGuardianCheck(slip({expiresAt: '2026-09-26T20:00:00Z'}), Date.parse('2026-09-26T19:59:59Z')), null)
})
