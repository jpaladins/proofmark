import { Cpu } from 'lucide-react'
import type { HashProgress as Progress } from '@/core/hash/hashFile'
import { formatBytes } from '@/core/pdf/content'
import { cx } from '../cx'
import { formatEta } from '../formatEta'

/**
 * Progress of the SHA-256 computation. Large archives can take minutes, so the panel shows that
 * work is happening (bytes read, speed, time left) and says the page is not frozen.
 */
export function HashProgress({ progress }: { progress?: Progress }) {
  const ratio = progress && progress.total > 0 ? Math.min(progress.bytesDone / progress.total, 1) : undefined
  const pct = ratio === undefined ? undefined : Math.floor(ratio * 100)
  return (
    <div className="rounded-xl border border-blue/25 bg-blue-soft/60 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p id="hash-progress-label" className="text-sm font-semibold text-ink">
          Calcolo dell'impronta SHA-256
        </p>
        <p className="font-mono text-2xl font-medium tabular-nums text-ink" aria-hidden>
          {pct === undefined ? '' : `${pct}%`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-labelledby="hash-progress-label"
        aria-valuemin={0}
        aria-valuemax={100}
        {...(pct === undefined
          ? { 'aria-valuetext': 'Avvio del calcolo' }
          : {
              'aria-valuenow': pct,
              'aria-valuetext': `${pct}% (${formatBytes(progress!.bytesDone)} di ${formatBytes(progress!.total)})`,
            })}
        className="relative mt-3 h-3 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-blue/20"
      >
        {pct === undefined ? (
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-blue/70 [animation:pm-indeterminate_1.2s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:opacity-40" />
        ) : (
          <div
            className={cx('h-full rounded-full bg-blue transition-[width] duration-150 ease-out', pct >= 100 && 'bg-emerald')}
            style={{ width: `${ratio! * 100}%` }}
          />
        )}
      </div>

      <p className="mt-2.5 text-sm tabular-nums text-ink-2">
        {progress
          ? `${formatBytes(progress.bytesDone)} di ${formatBytes(progress.total)} · ${progress.mbPerSec.toFixed(0)} MB/s · ${formatEta(progress.etaSec)}`
          : 'Avvio del calcolo…'}
      </p>
      <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted">
        <Cpu aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Il calcolo avviene sul tuo dispositivo e con gli archivi più grandi può richiedere qualche minuto. La pagina non è
          bloccata: puoi lasciarla aperta in background, ma non chiuderla.
        </span>
      </p>
    </div>
  )
}
