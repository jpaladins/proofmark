import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../cx'
import { useT } from '../LangContext'

/**
 * The archive's SHA-256 set as the page's centrepiece: eight groups of eight characters.
 * While hashing, placeholder groups fill in with the progress; the real value is revealed once.
 */
export function Fingerprint({ hash, progress, size = 'lg' }: { hash?: string; progress?: number; size?: 'lg' | 'md' }) {
  const groups = hash ? hash.match(/.{8}/g)! : Array.from({ length: 8 }, () => '········')
  const filled = hash ? 8 : Math.floor((progress ?? 0) * 8)
  const t = useT().fingerprint
  return (
    <p
      className={cx(
        'grid grid-cols-4 gap-x-3 gap-y-1 font-mono tracking-wide sm:grid-cols-8',
        size === 'lg' ? 'text-base sm:text-lg' : 'text-sm',
      )}
      aria-label={hash ? t.label(hash) : t.computing}
    >
      {groups.map((g, i) => (
        <span
          key={i}
          aria-hidden
          className={cx(
            'transition-colors duration-300',
            hash ? 'text-ink [animation:pm-reveal_.5s_ease-out_both]' : i < filled ? 'text-blue' : 'text-line-strong',
          )}
          style={hash ? { animationDelay: `${i * 45}ms` } : undefined}
        >
          {g}
        </span>
      ))}
    </p>
  )
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const t = useT().fingerprint
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          /* clipboard blocked: the value stays selectable on screen */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {copied ? <Check aria-hidden className="size-3.5 text-emerald" /> : <Copy aria-hidden className="size-3.5" />}
      <span aria-live="polite">{copied ? t.copied : t.copy}</span>
    </button>
  )
}
