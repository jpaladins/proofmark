import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import type { StepId, StepState } from '@/flow/certify'
import { cx } from '../cx'
import { useT } from '../LangContext'

const ORDER: StepId[] = ['hash', 'ots', 'cert']

function Marker({ n, status }: { n: number; status: StepState['status'] }) {
  const base = 'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors'
  if (status === 'done') return <span className={cx(base, 'bg-emerald text-bg')}><Check aria-hidden className="size-4" /></span>
  if (status === 'active')
    return (
      <span className={cx(base, 'border-2 border-blue text-blue')}>
        <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      </span>
    )
  if (status === 'warn') return <span className={cx(base, 'bg-amber-soft text-amber')}><AlertTriangle aria-hidden className="size-4" /></span>
  if (status === 'error') return <span className={cx(base, 'bg-red-soft text-red')}><X aria-hidden className="size-4" /></span>
  return <span className={cx(base, 'border border-line-strong text-muted')}>{n}</span>
}

export function Stepper({ steps }: { steps: Record<StepId, StepState> }) {
  const t = useT().stepper
  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:gap-0" aria-label={t.label}>
      {ORDER.map((id, i) => {
        const s = steps[id]
        return (
          <li
            key={id}
            aria-current={s.status === 'active' ? 'step' : undefined}
            className="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-4"
          >
            {i < ORDER.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  'absolute hidden h-px sm:block sm:left-10 sm:right-2 sm:top-4',
                  s.status === 'done' || s.status === 'warn' ? 'bg-emerald' : 'bg-line',
                )}
              />
            )}
            <Marker n={i + 1} status={s.status} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                <span data-label>{t.steps[id]}</span>
                <span className="sr-only">: {t.status[s.status]}</span>
              </p>
              <p className={cx('mt-0.5 text-xs', s.status === 'error' ? 'text-red' : s.status === 'warn' ? 'text-amber' : 'text-muted')}>
                {s.message ?? t.hints[id]}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
