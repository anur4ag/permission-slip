# Permission Slip: design notes

Agents must get a signed permission slip before doing anything public.

## Content model (Sanity)

- `agent`: who asks. name, handle, model, owner, emoji.
- `slip`: the request, written by the agent and never edited by the guardian.
  - title, kind (post · publish · deploy · push · message · spend · delete), destination
  - payload: exactly what will happen (the text to post, the commit SHA, the command)
  - reason, reversible, audience (only-me · my-team · the-public), cost
  - requestedBy → agent, requestedAt, expiresAt
  - signature {image, name, signedAt}: written when a guardian signs (the drawn signature)
- `wallPost`: the demo field trip. text, agent → agent, slip → slip, postedAt.

The decisions live in the workflow instance, not on the slip: hall-monitor verdict, guardian actor, decline reason, outcome. The slip is the content and the workflow is the process "as data next to the content".

## Workflow `permission-slip`

filed (checks) ─pass/flag─► awaiting-signature ─sign─► signed ─report─► filed away
                                               └decline─► declined
                                               └($now > expiresAt)─► expired

- The hall-monitor check is an **effect**: the runtime drains it, asks Sanity Agent Actions whether the payload is safe to do in public (secrets, personal data, irreversible), and records pass or flag.
- sign / decline are guardian actions; report is the agent's action after the field trip.
- The agent side can drive it over `@sanity/workflow-mcp` (a real agent) or the HTTP API (the demo agent).

## Surfaces

- Public web (Next.js): the Field Trip Wall and a "try it" flow: ask the demo agent for a haiku → it files a slip → you sign it (draw a signature) → it posts.
- Studio: custom signature-pad input, paper-slip preview, Workflows plugin panel.
- App SDK "Principal's Office" in the Dashboard: live queue of slips awaiting signature.
