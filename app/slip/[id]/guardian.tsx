'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import {SignaturePad} from '@/components/SignaturePad.tsx'

const asDataUrl = (b: Blob) => new Promise<string>((ok) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result))
  r.readAsDataURL(b)
})

export function Guardian({slipId, declineOnly = false}: {slipId: string; declineOnly?: boolean}) {
  const router = useRouter()
  const [png, setPng] = useState<Blob | null>(null)
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'' | 'sign' | 'decline'>('')
  const [error, setError] = useState('')
  const post = async (what: 'sign' | 'decline', body: object) => {
    setBusy(what)
    setError('')
    const r = await fetch(`/api/slips/${slipId}/${what}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)})
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setError(j.error ?? 'Something went wrong.')
    setBusy('')
    router.refresh()
  }
  return (
    <section aria-label="Guardian" style={{display: 'grid', gap: 12}}>
      {!declineOnly && (
        <>
          <p className="type" style={{margin: 0}}>
            I have read exactly what this agent will do, and I give permission.
          </p>
          <SignaturePad onChange={setPng} />
          <div className="row">
            <input className="grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" aria-label="Your name" />
            <button disabled={!!busy || !png || !name.trim()} onClick={async () => post('sign', {name, signature: await asDataUrl(png!)})}>
              {busy === 'sign' ? 'Signing…' : 'Sign the slip'}
            </button>
          </div>
        </>
      )}
      <div className="row">
        <input className="grow" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Or decline, with a reason" aria-label="Reason to decline" />
        <button className="quiet" disabled={!!busy || !reason.trim()} onClick={() => post('decline', {reason})}>
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// A demo slip that was signed but whose field trip didn't finish. The decision is recorded; this only completes it.
export function Finish({slipId}: {slipId: string}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = async () => {
    setBusy(true)
    setError('')
    const r = await fetch(`/api/slips/${slipId}/finish`, {method: 'POST'})
    const j = await r.json().catch(() => ({}))
    if (!r.ok) setError(j.error ?? 'Something went wrong.')
    setBusy(false)
    router.refresh()
  }
  return (
    <div className="row">
      <p className="muted" style={{margin: 0}}>Signed, but the field trip didn&apos;t finish.</p>
      <button disabled={busy} onClick={finish}>{busy ? 'Finishing…' : 'Finish the field trip'}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

// While the hall monitor runs, re-read the page every couple of seconds.
export function Refresh() {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000)
    return () => clearInterval(t)
  }, [router])
  return <p className="muted">The hall monitor is reading the slip…</p>
}
