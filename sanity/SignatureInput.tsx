import {useState} from 'react'
import {Button, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {set, useClient, type ObjectInputProps} from 'sanity'
import {SignaturePad} from '../components/SignaturePad.tsx'

type Signature = {image?: {asset?: {_ref?: string}}; name?: string; signedAt?: string}

// Replaces the default object form for slip.signature with a pen-and-paper signature line.
// Signing here only attaches the drawing; moving the slip forward is the workflow's "Sign" action.
export function SignatureInput(props: ObjectInputProps<Signature>) {
  const {value, onChange, readOnly} = props
  const client = useClient({apiVersion: '2025-02-19'})
  const [png, setPng] = useState<Blob | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (value?.image?.asset?._ref) {
    const [, id, dims, ext] = value.image.asset._ref.split('-')
    const url = `https://cdn.sanity.io/images/${client.config().projectId}/${client.config().dataset}/${id}-${dims}.${ext}`
    return (
      <div style={{padding: 12, borderRadius: 6, border: '1px solid #a8d5b0', background: '#f1faf2'}}>
        <Stack gap={3}>
          <img src={url} alt={`Signature of ${value.name ?? 'the guardian'}`} style={{maxHeight: 90, maxWidth: '100%'}} />
          <Text size={1} muted>
            Signed by {value.name ?? 'unknown'} {value.signedAt ? `on ${new Date(value.signedAt).toLocaleString()}` : ''}
          </Text>
        </Stack>
      </div>
    )
  }

  const attach = async () => {
    if (!png || !name.trim()) return
    setBusy(true)
    const asset = await client.assets.upload('image', png, {filename: 'signature.png'})
    onChange(set({_type: 'object', image: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}, name: name.trim(), signedAt: new Date().toISOString()}))
    setBusy(false)
  }

  return (
    <div style={{padding: 12, borderRadius: 6, border: '1px solid #ddd'}}>
      <Stack gap={3}>
        <SignaturePad onChange={setPng} height={120} />
        <Flex gap={2}>
          <TextInput placeholder="Your name as the guardian" value={name} onChange={(e) => setName(e.currentTarget.value)} readOnly={readOnly} />
          <Button text={busy ? 'Attaching…' : 'Attach signature'} tone="primary" disabled={readOnly || busy || !png || !name.trim()} onClick={attach} />
        </Flex>
        <Text size={1} muted>
          Then use the workflow's Sign action above to approve the field trip.
        </Text>
      </Stack>
    </div>
  )
}
