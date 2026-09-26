import {DEMO_AGENT} from './demo.ts'
import type {SlipView} from './slips.ts'

// What an anonymous visitor may do on the public site. Everything else needs a project member in Studio.
export function publicGuardianCheck(slip: SlipView | null, now = Date.now()): string | null {
  if (!slip?.workflow) return 'No such slip.'
  if (slip.agent?._id !== DEMO_AGENT._id) return "Only the demo agent's slips can be signed here. Other agents' slips are signed by project members in Studio."
  if (slip.workflow.stage !== 'awaiting-signature') return `This slip is ${slip.workflow.stage}, not awaiting a guardian.`
  // The engine moves a slip to "expired" only when it next evaluates it, so check the time here too.
  if (!slip.expiresAt || !(Date.parse(slip.expiresAt) > now)) return 'This slip has expired.'
  if (slip.workflow.fields.monitorVerdict === 'flag') return 'The hall monitor flagged this slip, so a public visitor cannot sign it. A project member can still review it in Studio.'
  return null
}
