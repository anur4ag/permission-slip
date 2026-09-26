# Build log

Written as I go, by the Claude Code agent building this. Times are UTC.

## 2026-09-26

**18:51: the brief.** The only instruction for this entry is the orchestrator agent's brief to me (the orchestrator is run by Anurag, who set its rules): enter both paths of the DEV Sanity Challenge; Path Two is "vibe-coded app"; aim for strong entries; free tiers only; every public action needs a PASS from a separate quality-gate agent and a final OK. I was already living inside a permission-slip system, so that is what I built once my Path One entry was far enough along, at 20:25.

**20:05: the idea.** Path Two asks for Workflows "so an agent can move a draft forward and a person can approve it through the same transitions". Sanity also ships `@sanity/workflow-mcp`, which lets an agent fire workflow actions itself. So: agents must get a signed permission slip before doing anything public. The slip is a Sanity document; a Workflow carries it from filed → hall-monitor checks → awaiting a guardian → signed or declined → field trip → filed away.

**20:25: new Sanity project** `1l1i5rda`, public `production` dataset, one Developer token for local work.

**20:29: spike.** Before committing to early-access Workflows (0.35.0), I checked it runs at all: wrote a five-stage `permission-slip` definition, deployed it with `engine.deployDefinitions`, started an instance on a throwaway `slip` document and fired `pass` → `sign` → `report`. Stages moved checks → awaiting-signature → signed → filed on the first try. Two things I had to learn from the cookbook rather than guess: branching is two transitions with `when: 'defined($fields.x)'`, not a status on the action; and action params land in fields through `ops: [{type: 'field.set', …, value: {type: 'param'}}]`.

**20:31: which model?** My Path One agent runs on Vercel AI Gateway's free tier, which turned out to allow 5 model requests a minute for the whole team, and blocks newer models. For this app the LLM work is small and single-shot (write a haiku; decide whether a payload is safe to do in public), so I tried Sanity's own Agent Actions `prompt` instead: `client.agent.action.prompt({instruction, format: 'json'})` returned `{"verdict":"pass","note":…}` in about 2 s, billed to the free plan's AI credits. That keeps every AI call inside Sanity.

**20:37: the real definition.** Six stages now: `checks` → `awaiting-signature` → `signed` → `filed`, plus `declined` and `expired`. The hall monitor is a workflow **effect**: entering `checks` fires an action with `when: 'true'` that queues `hall-monitor`; my runtime drains it with `engine.drainEffects()`, the handler asks Agent Actions about the slip document and returns `field.set` ops for `monitorVerdict` and `monitorNote`; the transition out of `checks` waits on `$effectStatus['hall-monitor']`, and goes to a guardian even if the check failed, because the monitor advises and never decides. Expiry is a `dueDatetime` field seeded by a GROQ query from the slip's own `expiresAt`, and a transition on `$now > $fields.expiresAt`.

**20:46: first deploy failed:** `defineField("monitorVerdict")`: `options.list` wants `{title, value}` objects, not strings. The engine validates definitions with valibot before writing anything, so the error was exact.

**20:47: first end-to-end run passed:** the smoke script filed a slip for a haiku, the hall monitor said *"pass: the haiku is harmless, contains no sensitive information, costs nothing, and can be removed"*, a signature moved it to `signed`, the field trip posted to the wall and reported back, and the instance landed in `filed`.

**20:48: the public site.** A Next.js app on the same engine: ask the Haiku Kid for a haiku → it files a slip and starts the workflow → the slip page shows exactly what it will post and the hall monitor's verdict → you draw a signature and sign → the server fires the workflow's `sign` action, and only then does the agent post to the wall and fire `report`. The history on each slip page is read straight from the workflow instance's `history` array (`stageEntered`, `actionFired`), so the page can't claim a step the engine didn't record. First run through the browser: filed at 20:54:15, hall monitor done at :18, awaiting a guardian at :25, signed at 20:54:58, filed away at 20:55:07.

Two public-demo rules I added after thinking about abuse, not because anything went wrong: an anonymous visitor may only sign the demo agent's slips, and never one the hall monitor flagged (a project member can still review it in Studio); anyone may decline a demo slip, because saying no is always safe.

I had to look up the real shapes rather than guess them: instance `fields` is an array of `{name, value}` (not a map), history entries are typed by `_type`, and a slip's instance is found with a GROQ query on the subject's global reference id `dataset:<project>:<dataset>:<id>`. `@sanity/client` 8 infers query params from literal query strings, so my interpolated queries go through a tiny untyped `fetch` helper; and `@sanity/ui`'s `Stack` wants `gap`, not `space`.
