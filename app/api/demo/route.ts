import {fileHaikuSlip} from '@/lib/demo.ts'
import {allow, ipOf} from '@/lib/ratelimit.ts'

export const maxDuration = 60

// Ask the demo agent for a haiku. It files a permission slip; nothing is posted until someone signs.
export async function POST(req: Request) {
  const {topic} = ((await req.json().catch(() => null)) ?? {}) as {topic?: unknown}
  if (typeof topic !== 'string' || !topic.trim() || topic.length > 60) return Response.json({error: 'Give a topic of up to 60 characters.'}, {status: 400})
  if (!allow(`ask:${ipOf(req)}`, 3, 10 * 60_000, 60)) return Response.json({error: 'The Haiku Kid needs a break; try again in a few minutes.'}, {status: 429})
  const r = await fileHaikuSlip(topic.trim())
  return 'error' in r ? Response.json(r, {status: 422}) : Response.json(r)
}
