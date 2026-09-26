import {haikuFieldTrip} from '@/lib/demo.ts'
import {engine, fieldOf, settled, writeClient} from '@/lib/engine.ts'
import {publicGuardianCheck} from '@/lib/guardian.ts'
import {allow, ipOf} from '@/lib/ratelimit.ts'
import {getSlip} from '@/lib/slips.ts'

export const maxDuration = 60
const MAX_PNG = 200_000
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const UNUSABLE = {error: 'That signature image is not usable.'}

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {name, signature} = ((await req.json().catch(() => null)) ?? {}) as {name?: unknown; signature?: unknown}
  if (typeof name !== 'string' || !name.trim() || name.length > 40) return Response.json({error: 'Sign with a name of up to 40 characters.'}, {status: 400})
  if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,')) return Response.json({error: 'Draw a signature first.'}, {status: 400})
  const png = Buffer.from(signature.slice('data:image/png;base64,'.length), 'base64')
  if (png.length < 200 || png.length > MAX_PNG || !png.subarray(0, 8).equals(PNG_MAGIC)) return Response.json(UNUSABLE, {status: 400})
  if (!allow(`sign:${ipOf(req)}`, 5, 10 * 60_000, 150)) return Response.json({error: 'Too many signatures from here; try again later.'}, {status: 429})

  const slip = await getSlip(id)
  const refusal = publicGuardianCheck(slip)
  if (refusal) return Response.json({error: refusal}, {status: 409})

  // 1. Store the drawing before deciding anything. Sanity decodes the image, so one it can't read fails here,
  //    while the slip is still awaiting a guardian.
  let assetId: string
  try {
    assetId = (await writeClient.assets.upload('image', png, {filename: `signature-${id}.png`, contentType: 'image/png'}))._id
  } catch {
    return Response.json(UNUSABLE, {status: 400})
  }
  // 2. The decision, with the drawing, goes through the workflow's own Sign action. The engine commits it against the
  //    instance's revision, so of two guardians signing at once exactly one wins. An error doesn't say whether the
  //    action committed, so the settled instance decides. The uploaded image is never deleted here: its id may be the
  //    recorded winner's (identical uploads share an id), and an unused upload is harmless.
  const instanceId = slip!.workflow!.instanceId
  try {
    await engine.fireAction({instanceId, activity: 'guardian', action: 'sign', params: {name: name.trim(), signature: assetId}})
  } catch {
    const now = await settled(instanceId).catch(() => null)
    const signer = now && fieldOf(now, 'guardianName')
    if (!now) return Response.json({error: "We couldn't confirm whether your signature went through. Refresh the slip to see where it stands."}, {status: 502})
    if (!signer && now.currentStage === 'awaiting-signature') return Response.json({error: 'Signing did not go through, and the slip still awaits a guardian. Try again.'}, {status: 502})
    const ours = signer === name.trim() && (fieldOf(now, 'guardianSignature') as {asset?: string} | undefined)?.asset === assetId
    if (!ours) return Response.json({error: 'Someone else decided on this slip first.'}, {status: 409})
    // Our signature committed even though the request errored: carry on.
  }
  // 3. Signed. The field trip only needs what the workflow recorded, so if it fails here it can be finished later.
  try {
    return Response.json({ok: true, postId: await haikuFieldTrip(instanceId, id)})
  } catch {
    return Response.json({error: 'Signed, but the field trip did not finish. Use "Finish the field trip" on the slip to try again.'}, {status: 502})
  }
}
