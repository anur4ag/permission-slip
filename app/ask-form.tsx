'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

export function AskForm() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await fetch('/api/demo', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({topic})})
    const j = await r.json().catch(() => ({error: 'Something went wrong.'}))
    if (j.slipId) router.push(`/slip/${j.slipId}`)
    else (setError(j.error ?? 'Something went wrong.'), setBusy(false))
  }
  return (
    <form className="row" onSubmit={submit}>
      <label className="grow">
        <span className="muted">A haiku about…</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder="rain on a tin roof" required />
      </label>
      <button type="submit" disabled={busy || !topic.trim()} style={{alignSelf: 'end'}}>{busy ? 'Filing a slip…' : 'Ask the Haiku Kid'}</button>
      {error && <p className="error" role="alert" style={{flexBasis: '100%', margin: 0}}>{error}</p>}
    </form>
  )
}
