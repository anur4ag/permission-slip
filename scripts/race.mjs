// Usage: npm run build && npm start (port 3000), then node scripts/race.mjs [base URL].
// Files one real demo slip (two Agent Actions prompts), then two guardians sign it at the same moment.
// Asserts one 200 and one 409, and that a non-PNG signature is refused. Then check the printed slip in Studio: its signature,
// the workflow's guardianName and the one wall post should all belong to the winner.
import {deflateSync} from 'node:zlib'
const base = process.argv[2] ?? 'http://127.0.0.1:3000'
const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]) }
function png(seed) {
  const w = 120, h = 40, raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.abs(y - 20 - 12 * Math.sin((x + seed) / 9)) < 2) raw.writeUInt32BE(0x1a2a6cff, y * (w * 4 + 1) + 1 + x * 4)
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64')
}
const post = (path, body, ip) => fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', 'x-forwarded-for': ip}, body: JSON.stringify(body)}).then(async (r) => ({status: r.status, body: await r.json().catch(() => null)}))
const filed = await post('/api/demo', {topic: 'two pens, one slip'}, '10.0.0.1')
console.log('filed', filed.status, filed.body)
const id = filed.body.slipId
const [a, b] = await Promise.all([post(`/api/slips/${id}/sign`, {name: 'Race A', signature: png(0)}, '10.0.0.2'), post(`/api/slips/${id}/sign`, {name: 'Race B', signature: png(40)}, '10.0.0.3')])
console.log('A', a.status, a.body, '\nB', b.status, b.body)
const junk = await post(`/api/slips/${id}/sign`, {name: 'Junk', signature: 'data:image/png;base64,' + Buffer.alloc(400, 1).toString('base64')}, '10.0.0.4')
console.log('non-PNG', junk.status, junk.body)
console.log('SLIP', id)
if ([a.status, b.status].sort().join() !== '200,409' || junk.status !== 400) throw new Error('race check failed')
