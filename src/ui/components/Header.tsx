import { Moon, ShieldCheck, Sun } from 'lucide-react'
import type { MouseEvent } from 'react'
import { toUrl, useRoute, type PageId } from '../router'
import { useTheme } from '../useTheme'
import { cx } from '../cx'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id="pm-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#059669" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M32 4 54 12v18c0 14-9.5 24.5-22 30C19.5 54.5 10 44 10 30V12z" fill="url(#pm-logo-g)" />
      <path d="M32 15v4M20 43l3.5-2.5M44 43l-3.5-2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
      <circle cx="32" cy="31" r="11" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M32 24.5V31l4.5 2.8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="13" r="2.6" fill="#fff" />
      <circle cx="18.5" cy="44" r="2.6" fill="#fff" />
      <circle cx="45.5" cy="44" r="2.6" fill="#fff" />
    </svg>
  )
}

function NavLink({ page, children }: { page: PageId; children: string }) {
  const { page: current, lang, navigate } = useRoute()
  const active = current === page
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(page)
  }
  return (
    <a
      href={toUrl(page, lang)}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex-1 rounded-md px-2.5 py-1.5 text-center text-sm font-medium transition-colors min-[420px]:flex-none sm:px-3',
        active
          ? 'bg-surface text-ink shadow-sm min-[420px]:bg-sunken min-[420px]:shadow-none'
          : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </a>
  )
}

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Passa al tema scuro' : 'Passa al tema chiaro'}
      className="grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {resolved === 'dark' ? <Sun aria-hidden className="size-4.5" /> : <Moon aria-hidden className="size-4.5" />}
    </button>
  )
}

export function Header() {
  const { lang, navigate } = useRoute()
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sticky top-0 z-20">
      {/* Below 420px the sections drop to a second row of full-width tabs, so the title always fits. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 min-[420px]:flex-nowrap sm:gap-x-6 sm:px-6">
        <a
          href={toUrl('certify', lang)}
          onClick={(e) => {
            e.preventDefault()
            navigate('certify')
          }}
          className="flex shrink-0 items-center gap-2.5"
        >
          <Logo className="size-8" />
          <span className="font-serif text-lg font-semibold tracking-tight">ProofMark</span>
        </a>
        <nav
          aria-label="Sezioni"
          className="order-last flex w-full items-center gap-1 rounded-lg bg-sunken p-1 min-[420px]:order-none min-[420px]:w-auto min-[420px]:shrink-0 min-[420px]:gap-0.5 min-[420px]:bg-transparent min-[420px]:p-0 sm:gap-1"
        >
          <NavLink page="certify">Certifica</NavLink>
          <NavLink page="verify">Verifica</NavLink>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <p className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald/30 bg-emerald-soft px-3 py-1 text-xs font-medium text-emerald-ink lg:flex">
            <ShieldCheck aria-hidden className="size-3.5" />
            <span>Zero-Knowledge: i file vengono elaborati solo nel tuo browser</span>
          </p>
          {/* Below 640px only the shield, so the bar fits a 320px phone; the short label up to 1024px, then the full one. */}
          <p
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald/30 bg-emerald-soft px-1.5 py-1 text-xs font-medium text-emerald-ink sm:px-2 lg:hidden"
            title="Zero-Knowledge: i file vengono elaborati solo nel tuo browser"
          >
            <ShieldCheck aria-hidden className="size-3.5" />
            <span aria-hidden className="hidden sm:inline">
              Zero-Knowledge
            </span>
            <span className="sr-only">Zero-Knowledge</span>
          </p>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
