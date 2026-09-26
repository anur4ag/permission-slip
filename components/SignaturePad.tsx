'use client'

import {useEffect, useRef, useState} from 'react'

// A plain canvas signature pad, used both in the public app and inside Sanity Studio.
// Exports the drawing as a PNG blob; `empty` tells the parent whether anything was drawn.
export function SignaturePad({onChange, height = 140}: {onChange: (png: Blob | null) => void; height?: number}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvas.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.clientWidth * ratio
    c.height = height * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1b2a6b' // fountain-pen blue
  }, [height])

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(...point(e))
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvas.current!.getContext('2d')!
    ctx.lineTo(...point(e))
    ctx.stroke()
    if (empty) setEmpty(false)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    canvas.current!.toBlob((b) => onChange(b), 'image/png')
  }
  const clear = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div style={{display: 'grid', gap: 6}}>
      <canvas
        ref={canvas}
        aria-label="Draw your signature"
        role="img"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{width: '100%', height, touchAction: 'none', cursor: 'crosshair', background: 'repeating-linear-gradient(transparent 0 calc(100% - 22px), #c9c2a8 calc(100% - 22px) calc(100% - 21px), transparent calc(100% - 21px))', border: '1px solid #d8d1b8', borderRadius: 6}}
      />
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b6451'}}>
        <span>{empty ? 'Sign above with your mouse or finger' : 'Signed'}</span>
        <button type="button" onClick={clear} disabled={empty} style={{background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer'}}>
          Clear
        </button>
      </div>
    </div>
  )
}
