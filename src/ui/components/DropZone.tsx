import { FileArchive, UploadCloud, XCircle } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { validateZip } from '@/core/zip/isZip'
import type { Messages } from '@/i18n'
import { cx } from '../cx'
import { useRich } from '../i18n'
import { useT } from '../LangContext'

type State = 'idle' | 'over' | 'rejected' | 'accepted'

/** Default validation: a real ZIP archive. Returns an error message or undefined. */
async function zipError(file: File, reasons: Messages['dropZone']['reasons']): Promise<string | undefined> {
  const v = await validateZip(file)
  return v.ok ? undefined : reasons[v.reason]
}

export function DropZone({
  onFile,
  disabled,
  label,
  compact,
  validate,
  inputLabel,
  accept = '.zip,application/zip,application/x-zip-compressed',
  multipleMessage,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  label?: string
  compact?: boolean
  validate?: (file: File) => Promise<string | undefined>
  inputLabel?: string
  accept?: string
  multipleMessage?: string
}) {
  const id = useId()
  const t = useT().dropZone
  const rich = useRich().dropZone
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string>()
  const [accepted, setAccepted] = useState<File>()

  async function take(files: FileList | null | undefined) {
    if (!files || files.length === 0 || disabled) return
    if (files.length > 1) {
      setState('rejected')
      setMessage(multipleMessage ?? t.multiple)
      return
    }
    const file = files[0]
    const problem = await (validate ? validate(file) : zipError(file, t.reasons))
    if (problem) {
      setState('rejected')
      setMessage(problem)
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
        accept={accept}
        aria-label={inputLabel ?? t.inputLabel}
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
            {state === 'over' ? t.release : accepted ? accepted.name : (label ?? t.label)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {rich.orChoose(
              <label
                htmlFor={id}
                className="cursor-pointer font-medium text-blue underline underline-offset-4 hover:text-ink"
              >
                {t.choose}
              </label>,
              !compact,
            )}
          </p>
        </div>
      </div>
      <p role="alert" className={cx('text-center text-sm font-medium text-red', message ? 'mt-4' : 'sr-only')}>
        {message}
      </p>
    </div>
  )
}
