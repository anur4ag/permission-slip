import {defineField, defineType} from 'sanity'
import {SignatureInput} from './SignatureInput.tsx'

export const agent = defineType({
  name: 'agent',
  title: 'Agent',
  type: 'document',
  description: 'An AI agent that has to ask before it does anything public.',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'handle', type: 'slug', options: {source: 'name'}, validation: (r) => r.required()}),
    defineField({name: 'emoji', type: 'string', description: 'Shown on its slips', validation: (r) => r.max(4)}),
    defineField({name: 'model', type: 'string', description: 'What it runs on, e.g. "Sanity Agent Actions" or "Claude Code"'}),
    defineField({name: 'owner', type: 'string', description: 'The person responsible for this agent'}),
    defineField({name: 'bio', type: 'text', rows: 2}),
  ],
  preview: {select: {title: 'name', subtitle: 'model', emoji: 'emoji'}, prepare: ({title, subtitle, emoji}) => ({title: `${emoji ?? ''} ${title}`, subtitle})},
})

export const slip = defineType({
  name: 'slip',
  title: 'Permission slip',
  type: 'document',
  description:
    'What an agent wants to do in public, written by the agent. The decision about it (hall monitor verdict, guardian, outcome) lives in the permission-slip workflow instance next to it, not on this document.',
  fields: [
    defineField({name: 'title', type: 'string', description: 'The field trip in a few words, e.g. "Post a haiku on the Field Trip Wall"', validation: (r) => r.required().max(120)}),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['post', 'publish', 'deploy', 'push', 'message', 'spend', 'delete'], layout: 'radio', direction: 'horizontal'},
      validation: (r) => r.required(),
    }),
    defineField({name: 'destination', type: 'string', description: 'Where it happens: a URL, a repo, a channel', validation: (r) => r.required()}),
    defineField({name: 'payload', type: 'text', rows: 4, description: 'Exactly what will be done: the text to post, the commit, the command. The guardian signs this, not a summary of it.', validation: (r) => r.required().max(2000)}),
    defineField({name: 'reason', type: 'text', rows: 2, description: 'Why the agent wants to do it'}),
    defineField({name: 'reversible', type: 'boolean', description: 'Can it be undone cleanly?', initialValue: false}),
    defineField({name: 'audience', type: 'string', options: {list: ['only-me', 'my-team', 'the-public'], layout: 'radio', direction: 'horizontal'}}),
    defineField({name: 'costUsd', title: 'Cost (USD)', type: 'number', validation: (r) => r.min(0)}),
    defineField({name: 'requestedBy', type: 'reference', to: [{type: 'agent'}], validation: (r) => r.required()}),
    defineField({name: 'requestedAt', type: 'datetime', validation: (r) => r.required()}),
    defineField({name: 'expiresAt', type: 'datetime', description: 'Unsigned slips expire; the workflow checks this with $now'}),
    defineField({
      name: 'signature',
      type: 'object',
      description: "Written when a guardian signs: the drawn signature and the name they gave.",
      components: {input: SignatureInput},
      fields: [
        defineField({name: 'image', type: 'image'}),
        defineField({name: 'name', type: 'string'}),
        defineField({name: 'signedAt', type: 'datetime'}),
      ],
    }),
  ],
  orderings: [{title: 'Newest', name: 'newest', by: [{field: 'requestedAt', direction: 'desc'}]}],
  preview: {select: {title: 'title', subtitle: 'requestedBy.name', kind: 'kind'}, prepare: ({title, subtitle, kind}) => ({title, subtitle: `${kind} · ${subtitle ?? 'unknown agent'}`})},
})

export const wallPost = defineType({
  name: 'wallPost',
  title: 'Field Trip Wall post',
  type: 'document',
  description: 'The demo field trip: something an agent posted after its slip was signed.',
  fields: [
    defineField({name: 'text', type: 'text', rows: 4, validation: (r) => r.required().max(500)}),
    defineField({name: 'agent', type: 'reference', to: [{type: 'agent'}], validation: (r) => r.required()}),
    defineField({name: 'slip', type: 'reference', to: [{type: 'slip'}], validation: (r) => r.required()}),
    defineField({name: 'postedAt', type: 'datetime', validation: (r) => r.required()}),
  ],
})

export const schemaTypes = [agent, slip, wallPost]
