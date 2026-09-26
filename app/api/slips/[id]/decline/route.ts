import {engine} from '@/lib/engine.ts'
import {DEMO_AGENT} from '@/lib/demo.ts'
import {allow, ipOf} from '@/lib/ratelimit.ts'
import {getSlip} from '@/lib/slips.ts'

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {reason} = ((await req.json().catch(() => null)) ?? {}) as {reason?: unknown}
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 200) return Response.json({error: 'Give a reason of up to 200 characters.'}, {status: 400})
  if (!allow(`decline:${ipOf(req)}`, 5, 10 * 60_000, 150)) return Response.json({error: 'Too many decisions from here; try again later.'}, {status: 429})
  const slip = await getSlip(id)
  // Visitors may decline the demo agent's slips, flagged or not: saying no is always safe. Real agents' slips are for project members.
  if (slip?.agent?._id !== DEMO_AGENT._id || slip.workflow?.stage !== 'awaiting-signature') return Response.json({error: "Only the demo agent's slips that are awaiting a guardian can be declined here."}, {status: 409})
  await engine.fireAction({instanceId: slip!.workflow!.instanceId, activity: 'guardian', action: 'decline', params: {reason: reason.trim()}})
  return Response.json({ok: true})
}
