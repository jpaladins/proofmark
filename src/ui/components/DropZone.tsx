import { FileArchive, UploadCloud, XCircle } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { validateZip } from '@/core/zip/isZip'
import { cx } from '../cx'

const REASON_COPY = {
  extension: 'Carica un file .zip',
  signature: 'Il file non è un archivio ZIP valido',
  empty: "L'archivio è vuoto",
} as const

type State = 'idle' | 'over' | 'rejected' | 'accepted'

export function DropZone({
  onFile,
  disabled,
  label = "Trascina qui l'archivio .zip",
  compact,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  label?: string
  compact?: boolean
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string>()
  const [accepted, setAccepted] = useState<File>()

  async function take(files: FileList | null | undefined) {
    if (!files || files.length === 0 || disabled) return
    if (files.length > 1) {
      setState('rejected')
      setMessage('Carica un solo archivio .zip')
      return
    }
    const file = files[0]
    const v = await validateZip(file)
    if (!v.ok) {
      setState('rejected')
      setMessage(REASON_COPY[v.reason])
      setAccepted(undefined)
      return
    }
    setState('accepted')
    setMessage(undefined)
    setAccepted(file)
    onFile(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    void take(e.dataTransfer?.files)
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        if (!disabled) setState('over')
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setState(accepted ? 'accepted' : 'idle')
      }}
      onDrop={onDrop}
      className={cx(
        'group relative rounded-xl border-2 border-dashed transition-[background-color,border-color,transform] duration-200',
        compact ? 'px-5 py-6' : 'px-6 py-12 sm:py-16',
        state === 'over' && 'scale-[1.01] border-blue bg-blue-soft',
        state === 'rejected' && 'border-red bg-red-soft [animation:pm-shake_.3s_ease-in-out]',
        state === 'accepted' && 'border-emerald bg-emerald-soft',
        state === 'idle' && 'border-line-strong bg-surface hover:border-ink-2',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        aria-label="Seleziona archivio .zip"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          void take(e.target.files)
          e.target.value = ''
        }}
      />
      <div className={cx('flex items-center gap-4', compact ? 'flex-row' : 'flex-col text-center')}>
        <span
          className={cx(
            'grid place-items-center rounded-full',
            compact ? 'size-10' : 'size-14',
            state === 'rejected' ? 'bg-surface text-red' : state === 'accepted' ? 'bg-surface text-emerald' : 'bg-sunken text-ink-2',
          )}
        >
          {state === 'rejected' ? (
            <XCircle aria-hidden className="size-6" />
          ) : state === 'accepted' ? (
            <FileArchive aria-hidden className="size-6" />
          ) : (
            <UploadCloud aria-hidden className="size-6" />
          )}
        </span>
        <div className="min-w-0">
          <p className={cx('font-medium text-ink', compact ? 'text-sm' : 'text-lg')}>
            {state === 'over' ? "Rilascia l'archivio" : accepted ? accepted.name : label}
          </p>
          <p className="mt-1 text-sm text-muted">
            oppure{' '}
            <label
              htmlFor={id}
              className="cursor-pointer font-medium text-blue underline underline-offset-4 hover:text-ink"
            >
              scegli un file
            </label>
            {!compact && ', di qualsiasi dimensione'}
          </p>
        </div>
      </div>
      <p role="alert" className={cx('text-center text-sm font-medium text-red', message ? 'mt-4' : 'sr-only')}>
        {message}
      </p>
    </div>
  )
}
