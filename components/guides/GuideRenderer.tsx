import Link from 'next/link'
import type { Guide, GuideBlock } from '@/lib/guides/types'

// Registration CTA dropped into articles wherever a { kind: 'cta' } block sits.
// The free-during-beta line matters: it is the whole conversion pitch while the
// product takes no payment. If beta pricing ever changes, update this in one
// place and every guide follows.
function GuideCta() {
  return (
    <aside className="my-8 rounded-2xl border border-brand/20 bg-brand-50 p-6">
      <p className="font-heading text-lg font-bold text-ink">
        Practise the UK curriculum at home, free
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Decifer Learning covers Maths, English, Science, History and Geography for
        Years 1 to 11, matched to the National Curriculum your child follows at a
        British school. Everything is free while we are in beta. No card, no trial
        clock, no locked topics.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/register"
          className="flex h-11 items-center justify-center rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Create a free account
        </Link>
        <Link
          href="/curriculum"
          className="flex h-11 items-center justify-center rounded-xl border border-black/10 bg-surface px-6 text-sm font-semibold text-ink transition-colors hover:bg-black/5"
        >
          See every topic we cover
        </Link>
      </div>
    </aside>
  )
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <p
          className="leading-relaxed text-ink/90 [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      )
    case 'h2':
      return (
        <h2 id={block.id} className="scroll-mt-20 pt-4 font-heading text-2xl font-bold text-ink">
          {block.text}
        </h2>
      )
    case 'h3':
      return <h3 className="pt-2 font-heading text-lg font-bold text-ink">{block.text}</h3>
    case 'list': {
      const cls =
        'space-y-2 pl-5 leading-relaxed text-ink/90 [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline'
      const items = block.items.map((item, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
      ))
      return block.ordered ? (
        <ol className={`list-decimal ${cls}`}>{items}</ol>
      ) : (
        <ul className={`list-disc ${cls}`}>{items}</ul>
      )
    }
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-black/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            {block.caption ? (
              <caption className="border-b border-black/5 bg-surface px-4 py-2 text-left text-xs font-semibold text-muted">
                {block.caption}
              </caption>
            ) : null}
            <thead>
              <tr className="border-b border-black/10 bg-surface">
                {block.headers.map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-semibold text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-black/5 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 align-top text-ink/90">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'callout':
      return (
        <aside className="rounded-xl border border-brand/20 bg-brand-50 px-4 py-3">
          <p className="text-sm font-semibold text-ink">{block.title}</p>
          <p
            className="mt-1 text-sm leading-relaxed text-muted [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </aside>
      )
    case 'cta':
      return <GuideCta />
    case 'faq':
      return (
        <div className="divide-y divide-black/5 rounded-xl border border-black/10">
          {block.items.map(({ q, a }) => (
            <div key={q} className="px-4 py-4">
              <p className="font-semibold text-ink">{q}</p>
              <p
                className="mt-1 text-sm leading-relaxed text-muted [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline"
                dangerouslySetInnerHTML={{ __html: a }}
              />
            </div>
          ))}
        </div>
      )
  }
}

export function GuideRenderer({ guide }: { guide: Guide }) {
  const toc = guide.blocks.filter(
    (b): b is Extract<GuideBlock, { kind: 'h2' }> => b.kind === 'h2'
  )

  return (
    <article className="space-y-5">
      <div className="rounded-2xl border border-black/10 bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">The short answer</p>
        <p className="mt-2 text-lg leading-relaxed text-ink">{guide.keyAnswer}</p>
      </div>

      {toc.length >= 3 ? (
        <nav
          aria-label="On this page"
          className="rounded-xl border border-black/5 bg-surface px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">On this page</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="font-semibold text-brand-700 hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {guide.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      {guide.sources.length > 0 ? (
        <section className="rounded-xl border border-black/5 bg-surface px-4 py-4">
          <h2 className="text-sm font-semibold text-ink">Sources</h2>
          <p className="mt-1 text-xs text-muted">
            Facts in this guide come from public, verifiable sources. Fees and ratings change:
            always confirm directly with the school or regulator before making a decision.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {guide.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  rel="nofollow noopener"
                  target="_blank"
                  className="break-all font-semibold text-brand-700 hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
