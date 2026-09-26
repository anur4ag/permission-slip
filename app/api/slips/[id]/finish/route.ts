import {DEMO_AGENT, haikuFieldTrip} from '@/lib/demo.ts'
import {allow, ipOf} from '@/lib/ratelimit.ts'
import {getSlip} from '@/lib/slips.ts'

export const maxDuration = 60

// Finish a demo slip's field trip that was signed but didn't complete. The decision is already recorded in the
// workflow, and every step of the trip is idempotent, so anyone may retry it.
export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  if (!allow(`finish:${ipOf(req)}`, 5, 10 * 60_000, 150)) return Response.json({error: 'Too many tries from here; try again later.'}, {status: 429})
  const slip = await getSlip(id)
  if (slip?.agent?._id !== DEMO_AGENT._id || slip.workflow?.stage !== 'signed') return Response.json({error: "Only the demo agent's signed slips can be finished here."}, {status: 409})
  try {
    return Response.json({ok: true, postId: await haikuFieldTrip(slip.workflow.instanceId, id)})
  } catch {
    return Response.json({error: 'The field trip still did not finish; try again in a minute.'}, {status: 502})
  }
}
