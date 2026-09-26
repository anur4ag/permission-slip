// End-to-end check of public signing against a running build of this site and the real workflow engine.
// Usage: npm run build && npm start, then node --env-file=.env.local scripts/signing-check.ts [base URL]
// Files two real demo slips (four Agent Actions prompts), asserts, then deletes everything it created.
// 1. A 200-byte "PNG" that isn't an image is refused, and the slip still awaits a guardian (the approval wasn't used).
// 2. Two guardians sign at once: one 200, one 409; the drawing, guardianName and the single wall post are the winner's.
// 3. Signing is interrupted right after the decision (the workflow's sign fired, nothing else ran): another guardian
//    can't take over (409), and two "finish" calls at once complete it with one post and the first signer's drawing.
import assert from 'node:assert/strict'
import {deflateSync} from 'node:zlib'
import {fileHaikuSlip} from '../lib/demo.ts'
import {engine, writeClient} from '../lib/engine.ts'
import {getSlip} from '../lib/slips.ts'

const base = process.argv[2] ?? 'http://127.0.0.1:3000'
const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type: string, data: Buffer) => {
  const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  c.writeUInt32BE(crc(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, c])
}
// A small real PNG: a wavy pen line.
function png(seed: number) {
  const w = 120, h = 40, raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.abs(y - 20 - 12 * Math.sin((x + seed) / 9)) < 2) raw.writeUInt32BE(0x1a2a6cff, y * (w * 4 + 1) + 1 + x * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0), ihdr.writeUInt32BE(h, 4), (ihdr[8] = 8), (ihdr[9] = 6)
  return Buffer.concat([MAGIC, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const dataUrl = (b: Buffer) => 'data:image/png;base64,' + b.toString('base64')
const post = (path: string, body: object, ip: string) =>
  fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', 'x-forwarded-for': ip}, body: JSON.stringify(body)}).then(async (r) => ({status: r.status, body: (await r.json().catch(() => null)) as {postId?: string; error?: string} | null}))
const postsFor = (slipId: string) => writeClient.fetch<number>('count(*[_type == "wallPost" && slip._ref == $slipId])', {slipId})
const created: string[] = []
const file = async (topic: string) => {
  const r = await fileHaikuSlip(topic)
  if ('error' in r) throw new Error(r.error)
  created.push(r.slipId)
  return r
}

try {
  // 1 and 2
  const a = await file('two pens, one slip')
  const junk = await post(`/api/slips/${a.slipId}/sign`, {name: 'Junk', signature: dataUrl(Buffer.concat([MAGIC, Buffer.alloc(192)]))}, '10.0.1.1')
  assert.equal(junk.status, 400, 'a non-image must be refused')
  assert.equal((await getSlip(a.slipId))?.workflow?.stage, 'awaiting-signature', 'the refused signature must not use the approval')
  const [x, y] = await Promise.all([
    post(`/api/slips/${a.slipId}/sign`, {name: 'Race A', signature: dataUrl(png(0))}, '10.0.1.2'),
    post(`/api/slips/${a.slipId}/sign`, {name: 'Race B', signature: dataUrl(png(40))}, '10.0.1.3'),
  ])
  assert.deepEqual([x.status, y.status].sort(), [200, 409], 'exactly one signer wins')
  const winner = x.status === 200 ? 'Race A' : 'Race B'
  const sa = await getSlip(a.slipId)
  assert.equal(sa?.workflow?.stage, 'filed')
  assert.equal(sa?.signature?.name, winner)
  assert.equal(sa?.workflow?.fields.guardianName, winner)
  assert.equal(await postsFor(a.slipId), 1)
  console.log('race and junk: ok', {slip: a.slipId, winner})

  // 3
  const b = await file('a pen that paused')
  const asset = await writeClient.assets.upload('image', png(80), {filename: 'signature-interrupted.png', contentType: 'image/png'})
  await engine.fireAction({instanceId: b.instanceId, activity: 'guardian', action: 'sign', params: {name: 'Interrupted Ann', signature: asset._id}})
  const late = await post(`/api/slips/${b.slipId}/sign`, {name: 'Late Bob', signature: dataUrl(png(120))}, '10.0.1.4')
  assert.equal(late.status, 409, 'nobody else can sign a signed slip')
  const [f1, f2] = await Promise.all([post(`/api/slips/${b.slipId}/finish`, {}, '10.0.1.5'), post(`/api/slips/${b.slipId}/finish`, {}, '10.0.1.6')])
  assert.deepEqual([f1.status, f2.status], [200, 200])
  assert.equal(f1.body?.postId, f2.body?.postId)
  const sb = await getSlip(b.slipId)
  assert.equal(sb?.workflow?.stage, 'filed')
  assert.equal(sb?.signature?.name, 'Interrupted Ann')
  assert.equal(await postsFor(b.slipId), 1)
  console.log('interrupted then finished: ok', {slip: b.slipId, post: f1.body?.postId})
} finally {
  // Leave the public dataset as it was: the test slips, their posts, instances and signature images.
  for (const slipId of created) {
    const ids = await writeClient.fetch<string[]>(
      `[...*[_type == "wallPost" && slip._ref == $slipId]._id, ...*[_type == "sanity.workflow.instance" && ("dataset:1l1i5rda:production:" + $slipId) in fields[].value.id]._id, $slipId]`,
      {slipId},
    )
    const tx = writeClient.transaction()
    for (const id of ids) tx.delete(id)
    await tx.commit()
  }
  // Signature images nothing references any more; one still in use can't be deleted and is kept.
  for (const id of await writeClient.fetch<string[]>(`*[_type == "sanity.imageAsset" && originalFilename match "signature-*"]._id`)) await writeClient.delete(id).catch(() => {})
  console.log('cleaned up', created)
}
