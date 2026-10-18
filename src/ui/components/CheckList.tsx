import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { Check } from '@/core/verify/check'
import { cx } from '../cx'

const STATUS = {
  ok: { icon: CheckCircle2, text: 'Superato', color: 'text-emerald' },
  warn: { icon: AlertTriangle, text: 'Da controllare', color: 'text-amber' },
  fail: { icon: XCircle, text: 'Non superato', color: 'text-red' },
} as const

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul aria-label="Esito della verifica" className="divide-y divide-line border-y border-line">
      {checks.map((c) => {
        const s = STATUS[c.status]
        const Icon = s.icon
        return (
          <li key={c.id} className="flex gap-3 py-3.5">
            <Icon aria-hidden className={cx('mt-0.5 size-5 shrink-0', s.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                {c.label}
                <span className={cx('ml-2 text-xs font-medium', s.color)}>{s.text}</span>
              </p>
              {c.detail && (
                <p className="mt-1 whitespace-pre-line break-all font-mono text-xs text-muted">{c.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
