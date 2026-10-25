// Building blocks of the Privacy page, shared by its English and Italian content.
import { Check, Globe, LifeBuoy, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export const linkClass = 'font-medium text-blue underline underline-offset-4 hover:text-ink'

export function Intro({ updated, title, children }: { updated: string; title: string; children: ReactNode }) {
  return (
    <>
      <p className="text-sm text-muted">{updated}</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-ink-2">{children}</p>
    </>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 scroll-mt-24">
      <h2 id={id} className="font-serif text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[1.0625rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>
}

export function Summary({ label, items }: { label: string; items: { icon: LucideIcon; title: string; text: string }[] }) {
  return (
    <ul className="mt-10 grid gap-6 border-y border-line py-8 sm:grid-cols-3" aria-label={label}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title}>
          <Icon aria-hidden className="size-6 text-emerald" />
          <p className="mt-3 font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{text}</p>
        </li>
      ))}
    </ul>
  )
}

export type Outgoing = { who: string; hosts: string; when: string; what: string }

export function OutgoingTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: [service: string, when: string, what: string]
  rows: Outgoing[]
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden bg-sunken text-ink sm:table-header-group">
          <tr>
            <th scope="col" className="w-[34%] px-4 py-3 font-semibold">{headers[0]}</th>
            <th scope="col" className="w-[24%] px-4 py-3 font-semibold">{headers[1]}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{headers[2]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.hosts} className="block border-t border-line first:border-t-0 sm:table-row">
              <th scope="row" className="block px-4 pt-4 align-top font-normal sm:table-cell sm:py-4">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Globe aria-hidden className="size-4 shrink-0 text-muted" />
                  {row.who}
                </span>
                <span className="mt-1 block break-words font-mono text-xs text-muted">{row.hosts}</span>
              </th>
              <td className="block px-4 pt-2 align-top text-ink-2 sm:table-cell sm:py-4">{row.when}</td>
              <td className="block px-4 pb-4 pt-2 align-top text-ink-2 sm:table-cell sm:py-4">{row.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CheckItems({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <Check aria-hidden className="mt-1 size-4 shrink-0 text-emerald" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Help({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-14 flex gap-3 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-2">
      <LifeBuoy aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
      <p>{children}</p>
    </aside>
  )
}
