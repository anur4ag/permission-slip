import {defineAction, defineActivity, defineField, defineStage, defineTransition, defineWorkflow} from '@sanity/workflow-engine/define'

// The slip document is the request; everything decided about it lives in these workflow fields.
export const permissionSlip = defineWorkflow({
  name: 'permission-slip',
  title: 'Permission slip',
  description: 'An agent asks before it does something public. A hall monitor checks the request, a guardian signs or declines, and the agent reports back after the field trip.',
  initialStage: 'checks',
  fields: [
    defineField({type: 'subject', name: 'subject', title: 'Slip', required: true, initialValue: {type: 'input'}}),
    defineField({type: 'dueDatetime', name: 'expiresAt', title: 'Expires', initialValue: {type: 'query', query: '*[_id == $fields.subject.id][0].expiresAt'}}),
    defineField({type: 'string', name: 'monitorVerdict', title: 'Hall monitor verdict', options: {list: [{title: 'Pass', value: 'pass'}, {title: 'Flag', value: 'flag'}]}}),
    defineField({type: 'string', name: 'monitorNote', title: 'Hall monitor note'}),
    defineField({type: 'actor', name: 'guardian', title: 'Signed by (account)'}),
    defineField({type: 'string', name: 'guardianName', title: 'Signed by (name on the slip)'}),
    // The drawn signature's image asset, recorded with the decision so nothing after it depends on the request that made it.
    defineField({type: 'string', name: 'guardianSignature', title: 'Signature image (asset id)'}),
    defineField({type: 'string', name: 'declineReason', title: 'Why it was declined'}),
    defineField({type: 'string', name: 'outcome', title: 'What happened on the field trip'}),
  ],
  stages: [
    defineStage({
      name: 'checks',
      title: 'Hall monitor',
      description: 'Automated check: is the payload safe to do in public?',
      activities: [
        defineActivity({
          name: 'hall-monitor',
          title: 'Check the request',
          actions: [
            defineAction({
              name: 'run',
              title: 'Run the hall monitor',
              when: 'true', // fires as soon as the slip is filed
              status: 'done',
              effects: [{name: 'hall-monitor', bindings: {subject: '$fields.subject._id'}}],
            }),
          ],
        }),
      ],
      // A failed check still goes to a guardian: the monitor advises, it never decides.
      transitions: [
        defineTransition({
          name: 'to-guardian',
          title: 'Hand to a guardian',
          to: 'awaiting-signature',
          when: "$effectStatus['hall-monitor'] == 'done' || $effectStatus['hall-monitor'] == 'failed'",
        }),
      ],
    }),
    defineStage({
      name: 'awaiting-signature',
      title: 'Awaiting a guardian',
      description: 'A person reads exactly what the agent will do, and signs or declines.',
      activities: [
        defineActivity({
          name: 'guardian',
          title: 'Guardian decision',
          actions: [
            defineAction({
              name: 'sign',
              title: 'Sign the slip',
              status: 'done',
              params: [
                {type: 'string', name: 'name', title: 'Your name', required: true},
                {type: 'string', name: 'signature', title: 'Signature image (asset id), if drawn outside Studio'},
              ],
              ops: [
                {type: 'field.set', target: {field: 'guardian'}, value: {type: 'actor'}},
                {type: 'field.set', target: {field: 'guardianName'}, value: {type: 'param', param: 'name'}},
                {type: 'field.set', target: {field: 'guardianSignature'}, value: {type: 'param', param: 'signature'}},
              ],
            }),
            defineAction({
              name: 'decline',
              title: 'Decline',
              status: 'done',
              params: [{type: 'string', name: 'reason', title: 'Reason', required: true}],
              ops: [{type: 'field.set', target: {field: 'declineReason'}, value: {type: 'param', param: 'reason'}}],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-signed', title: 'Signed', to: 'signed', when: 'defined($fields.guardianName)'}),
        defineTransition({name: 'to-declined', title: 'Declined', to: 'declined', when: 'defined($fields.declineReason)'}),
        defineTransition({name: 'to-expired', title: 'Expired unsigned', to: 'expired', when: 'defined($fields.expiresAt) && $now > $fields.expiresAt'}),
      ],
    }),
    defineStage({
      name: 'signed',
      title: 'Signed: field trip approved',
      description: 'The agent may now do exactly what the slip says, and must report back.',
      activities: [
        defineActivity({
          name: 'field-trip',
          title: 'Go on the field trip',
          actions: [
            defineAction({
              name: 'report',
              title: 'Report back',
              status: 'done',
              params: [{type: 'string', name: 'outcome', title: 'What happened (a link is best)', required: true}],
              ops: [{type: 'field.set', target: {field: 'outcome'}, value: {type: 'param', param: 'outcome'}}],
            }),
          ],
        }),
      ],
      transitions: [defineTransition({name: 'to-filed', title: 'File it away', to: 'filed', when: '$allActivitiesDone'})],
    }),
    defineStage({name: 'declined', title: 'Declined', description: 'The agent may not go.'}),
    defineStage({name: 'expired', title: 'Expired', description: 'Nobody signed in time. The agent may not go.'}),
    defineStage({name: 'filed', title: 'Filed away', description: 'Done: signed, done and reported.'}),
  ],
})
