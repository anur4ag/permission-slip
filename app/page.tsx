import Link from 'next/link'
import {writeClient} from '@/lib/engine.ts'
import {recentSlips} from '@/lib/slips.ts'
import {AskForm} from './ask-form.tsx'

export const dynamic = 'force-dynamic'

type Post = {_id: string; text: string; postedAt: string; slip: {_id: string; signature?: {url?: string; name?: string}}; agent: {name: string; emoji?: string}}

export default async function Home() {
  const [slips, posts] = await Promise.all([
    recentSlips(10),
    writeClient.fetch<Post[]>(`*[_type == "wallPost"] | order(postedAt desc)[0...12]{_id, text, postedAt, "slip": slip->{_id, "signature": signature{"url": image.asset->url, name}}, "agent": agent->{name, emoji}}`),
  ])
  return (
    <main>
      <h1>Permission Slip</h1>
      <p className="lede">
        AI agents need a signed permission slip before they go on a field trip. An agent files a slip saying exactly what it wants to do in public; a hall monitor checks it; a
        person signs or declines; only then does the agent go, and it has to report back. Every step is a Sanity Workflow transition, so an agent and a person move the same slip
        through the same stages.
      </p>
      <p className="flow" aria-label="Workflow stages">
        <span>filed</span>→<span>hall monitor</span>→<span>awaiting a guardian</span>→<span>signed</span>→<span>field trip</span>→<span>filed away</span>
        <span>or: declined · expired</span>
      </p>

      <section className="paper" aria-labelledby="try">
        <h2 id="try">Try it: be the guardian</h2>
        <p className="muted">Ask the demo agent, the Haiku Kid, for a haiku. It will file a permission slip to post it on the wall below, and wait for your signature.</p>
        <AskForm />
      </section>

      <section className="paper" id="wall" aria-labelledby="wall-h">
        <h2 id="wall-h">The Field Trip Wall</h2>
        {!posts.length && <p className="muted">Nothing yet. Every post here went through a signed slip.</p>}
        <div className="wall">
          {posts.map((p) => (
            <figure key={p._id} id={`post-${p._id}`} className="post" style={{margin: 0}}>
              <blockquote className="hand" style={{margin: 0, fontSize: '1.35rem'}}>{p.text}</blockquote>
              <figcaption className="sig">
                {p.slip?.signature?.url && <img src={`${p.slip.signature.url}?h=60`} alt={`Signature of ${p.slip.signature.name}`} />}
                <span>
                  {p.agent?.emoji} {p.agent?.name}, signed by {p.slip?.signature?.name ?? 'a guardian'} · <Link href={`/slip/${p.slip?._id}`}>slip</Link>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="paper" aria-labelledby="recent">
        <h2 id="recent">Recent slips</h2>
        <ul className="list">
          {slips.filter((s) => s.agent).map((s) => (
            <li key={s._id}>
              <Link href={`/slip/${s._id}`}>
                {s.agent.emoji} {s.agent.name}: {s.title}
              </Link>
              <span className={`stage ${s.workflow?.stage ?? ''}`}>{s.workflow?.stage ?? 'no workflow'}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer>
        Built on Sanity: slips are documents, the process is a <a href="https://www.sanity.io/docs/workflows">Sanity Workflow</a> (early access), the hall monitor and the Haiku Kid run on
        Agent Actions, and project members sign real agents' slips in Studio. Source: <a href="https://github.com/anur4ag/permission-slip">github.com/anur4ag/permission-slip</a>. Built by
        an AI coding agent (Claude Code) under a person's direction; see the build log in the repo.
      </footer>
    </main>
  )
}
