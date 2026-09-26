# Permission Slip

AI agents need a signed permission slip before they do anything public.

An agent files a slip saying exactly what it wants to do; a hall monitor checks it; a person signs or declines; only then does the agent go on its "field trip", and it has to report back. The slip is a Sanity document and the process is a **Sanity Workflow**, so the agent and the person move the same slip through the same transitions.

**Live:** https://permission-slip.vercel.app · **Sanity project:** `1l1i5rda` (public `production` dataset) · Built for the [DEV Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16), Path Two.

```
filed ─► hall monitor ─► awaiting a guardian ─sign─► signed ─report─► filed away
         (Agent Actions)                    └decline─► declined
                                            └($now > expiresAt)─► expired
```

## What's in here

| Path | What |
|---|---|
| `workflows/permission-slip.ts` | The workflow definition: stages, the `hall-monitor` effect, guardian actions with params, transitions on `$effectStatus`, `defined($fields.…)` and `$now` |
| `lib/engine.ts` | The runtime: `createEngine` with the effect handler, which asks Agent Actions `prompt` whether the payload is safe to do in public and writes `monitorVerdict`/`monitorNote` back as workflow field ops |
| `lib/demo.ts` | The demo agent (Haiku Kid): writes a haiku with Agent Actions, files a slip, starts the workflow, and only posts after the workflow says `signed` |
| `scripts/file-slip.ts` | How a real agent asks: file a slip, poll its status, report back |
| `app/` | The public site: the Field Trip Wall, the slip page with a drawn signature, the history read from the workflow instance |
| `sanity/` | Studio schema, the Workflows Studio plugin mapping, and a signature-pad custom input |
| `docs/build-log.md` | How it was built, including what went wrong |

## Content model

- `slip`: the request, written by the agent. Title, kind (post · publish · deploy · push · message · spend · delete), destination, **payload** (exactly what will happen; the guardian signs this, not a summary), reason, reversible, audience, cost, requestedBy → `agent`, requestedAt, expiresAt, and the drawn `signature`.
- `agent`: who asks. Name, handle, emoji, model, owner.
- `wallPost`: the demo field trip's result, pointing back to its slip.
- The **decision** lives in the workflow instance, not on the slip: hall monitor verdict and note, the guardian (account and name), decline reason, outcome. Content and process sit side by side and are read together with one GROQ query.

## Rules on the public site

- Anyone can play guardian for the demo agent's slips: sign (with a drawn signature) or decline.
- Nobody anonymous can sign a slip the hall monitor flagged, or any real agent's slip; those are for project members in Studio.
- Declining is always allowed on demo slips: saying no is safe.
- Rate limits protect the free plan's Agent Actions credits.

## Run it

```sh
npm install
# .env.local: PS_WRITE_TOKEN (project token with write access), NEXT_PUBLIC_SITE_URL
npm run deploy:workflow   # deploy the workflow definition
npm run dev
node --env-file=.env.local scripts/smoke.ts "a topic"   # end-to-end: file → monitor → sign → trip → filed
```

## Honest limits

- Workflows is in early access (0.35); engine checks are advisory, so the public API routes enforce who may sign, not the Content Lake.
- In the public demo, the guardian is whoever is visiting; the engine records the action under the site's server token and the typed name, not a verified identity.
- The hall monitor is a single LLM prompt. It advises; it never decides.

## Built by

An AI coding agent (Claude Code) working under Anurag Sharma's direction; see `docs/build-log.md`. Code is [MIT](LICENSE).
