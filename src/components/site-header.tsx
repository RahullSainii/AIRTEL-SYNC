import Link from 'next/link';

const NAV = [
  { href: '/onboard', label: 'Owner journey' },
  { href: '/track', label: 'Track order' },
  { href: '/partner', label: 'Partner desk' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/architecture', label: 'Architecture & privacy' },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="Udyam Digital home">
      <span className="relative grid place-items-center size-8 rounded-[10px] bg-ink text-white">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path d="M4 18 L10 6 L13 12 L15.5 8 L20 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15.5" cy="8" r="2.1" fill="#e2462a" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[17px] font-semibold tracking-tight">Udyam Digital</span>
          <span className="block text-[11px] text-muted mt-0.5">by Accel Business</span>
        </span>
      )}
    </Link>
  );
}

export function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5">
        <Logo />
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-full px-3 py-1.5 transition-colors ${active === n.href ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper-2'}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/onboard" className="btn btn-brand btn-sm md:hidden">Start</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto max-w-7xl px-5 py-10 flex flex-col md:flex-row gap-6 justify-between text-sm text-muted">
        <div className="max-w-md">
          <Logo />
          <p className="mt-4 leading-relaxed">Team Techuminati · Accel YTL Hackathon 2026, Enterprise Track A. Accel Telecom is fictional; all businesses, registries and documents are synthetic specimens.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>)}
        </div>
      </div>
    </footer>
  );
}
