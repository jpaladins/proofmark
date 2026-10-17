import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-bg hover:bg-ink-2',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:border-ink hover:bg-sunken',
        variant === 'ghost' && 'text-ink-2 hover:bg-sunken hover:text-ink',
        className,
      )}
    />
  )
}

const TONES = {
  info: { box: 'border-blue/30 bg-blue-soft text-ink', icon: Info, iconClass: 'text-blue' },
  success: { box: 'border-emerald/30 bg-emerald-soft text-ink', icon: CheckCircle2, iconClass: 'text-emerald' },
  warning: { box: 'border-amber/30 bg-amber-soft text-ink', icon: AlertTriangle, iconClass: 'text-amber' },
  danger: { box: 'border-red/30 bg-red-soft text-ink', icon: XCircle, iconClass: 'text-red' },
} as const

export function Alert({
  tone,
  title,
  children,
  action,
}: {
  tone: keyof typeof TONES
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const t = TONES[tone]
  const Icon = t.icon
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-lg border p-4', t.box)}>
      <Icon aria-hidden className={cx('mt-0.5 size-5 shrink-0', t.iconClass)} />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-ink-2">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

export function Badge({ tone = 'muted', children }: { tone?: 'ok' | 'warn' | 'muted' | 'fail'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'ok' && 'bg-emerald-soft text-emerald-ink',
        tone === 'warn' && 'bg-amber-soft text-amber',
        tone === 'fail' && 'bg-red-soft text-red',
        tone === 'muted' && 'bg-sunken text-muted',
      )}
    >
      {children}
    </span>
  )
}

export { cx }
