import {haikuFieldTrip} from '@/lib/demo.ts'
import {engine, writeClient} from '@/lib/engine.ts'
import {publicGuardianCheck} from '@/lib/guardian.ts'
import {allow, ipOf} from '@/lib/ratelimit.ts'
import {getSlip} from '@/lib/slips.ts'

export const maxDuration = 60
const MAX_PNG = 200_000

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {name, signature} = ((await req.json().catch(() => null)) ?? {}) as {name?: unknown; signature?: unknown}
  if (typeof name !== 'string' || !name.trim() || name.length > 40) return Response.json({error: 'Sign with a name of up to 40 characters.'}, {status: 400})
  if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,')) return Response.json({error: 'Draw a signature first.'}, {status: 400})
  const png = Buffer.from(signature.slice('data:image/png;base64,'.length), 'base64')
  if (png.length < 200 || png.length > MAX_PNG) return Response.json({error: 'That signature image is not usable.'}, {status: 400})
  if (!allow(`sign:${ipOf(req)}`, 5, 10 * 60_000, 150)) return Response.json({error: 'Too many signatures from here; try again later.'}, {status: 429})

  const slip = await getSlip(id)
  const refusal = publicGuardianCheck(slip)
  if (refusal) return Response.json({error: refusal}, {status: 409})

  // The drawing goes on the slip (content); the decision goes through the workflow's own Sign action (process).
  const asset = await writeClient.assets.upload('image', png, {filename: `signature-${id}.png`, contentType: 'image/png'})
  await writeClient.patch(id).set({signature: {_type: 'object', image: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}, name: name.trim(), signedAt: new Date().toISOString()}}).commit()
  await engine.fireAction({instanceId: slip!.workflow!.instanceId, activity: 'guardian', action: 'sign', params: {name: name.trim()}})
  // Signed: the demo agent may now go on its field trip, and reports back through the workflow.
  const postId = await haikuFieldTrip(slip!.workflow!.instanceId, id)
  return Response.json({ok: true, postId})
}
