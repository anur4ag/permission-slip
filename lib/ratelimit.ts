// ponytail: in-memory, per server instance. Guards the free plan's Agent Actions credits; a shared store if traffic grows.
const hits = new Map<string, number[]>()
let day = {start: Date.now(), count: 0}

export function allow(key: string, perWindow: number, windowMs: number, perDay = 150, now = Date.now()) {
  if (now - day.start > 86_400_000) day = {start: now, count: 0}
  if (day.count >= perDay) return false
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= perWindow) return false
  hits.set(key, [...recent, now])
  day.count++
  return true
}
export const ipOf = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
