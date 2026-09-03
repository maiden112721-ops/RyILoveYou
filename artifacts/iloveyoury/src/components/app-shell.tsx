import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useGetSession, useHealthCheck, useLogout } from '@workspace/api-client-react';
import { CalendarDays, Heart, LogOut, Menu, PenLine, WalletCards, X } from 'lucide-react';

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
      <span className="relative grid h-10 w-10 place-items-center text-[19px] leading-none" aria-label="ILOVEYOURY logo">
        <Heart className="absolute h-10 w-10 fill-[hsl(var(--accent))] stroke-[hsl(var(--accent))]" />
        <span className="relative z-10 -translate-y-px">🌷</span>
      </span>
      {!compact && <span className="font-display text-[22px] leading-none tracking-tight">ILOVEYOURY<span className="text-[hsl(var(--accent))]">!!!</span></span>}
    </Link>
  );
}

const nav = [
  { href: '/', label: 'Today', icon: Heart },
  { href: '/feed', label: 'Letters', icon: PenLine },
  { href: '/scheduler', label: 'Scheduler', icon: CalendarDays },
  { href: '/wallet', label: 'Wallet', icon: WalletCards },
];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  useEffect(() => {
    if (!isLoading && session && !session.authenticated) setLocation('/login');
  }, [isLoading, session, setLocation]);
  if (isLoading) return <div className="min-h-[100dvh] bg-background p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-6"><div className="h-12 w-52 rounded-full bg-muted" /><div className="h-56 rounded-[28px] bg-muted" /></div></div>;
  if (!session?.authenticated) return null;
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const logout = useLogout();
  const { data: health } = useHealthCheck({ query: { staleTime: 60000, queryKey: getHealthCheckQueryKey() } });
  const [, setLocation] = useLocation();
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => setLocation('/login') });
  return (
    <div className="min-h-[100dvh] bg-background text-foreground paper-texture">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-12 flex items-center justify-between px-2">
          <LogoMark />
          <button className="rounded-lg p-2 text-sidebar-foreground/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-close-menu"><X size={19} /></button>
        </div>
        <nav className="space-y-2" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
              <Icon size={18} strokeWidth={location === href ? 2.3 : 1.7} />
              {label}
              {location === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/55 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[.15em] text-sidebar-foreground/50"><span className={`h-1.5 w-1.5 rounded-full ${health?.status === 'ok' ? 'bg-sidebar-primary' : 'bg-sidebar-foreground/40'}`} /> Private space</div>
            <p className="text-[13px] leading-relaxed text-sidebar-foreground/75">Just for the two of us — a little place to keep life close.</p>
          </div>
          <button onClick={handleLogout} disabled={logout.isPending} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="button-logout"><LogOut size={16} /> {logout.isPending ? 'Closing...' : 'Close space'}</button>
          <div className="px-4 font-mono text-[10px] tracking-[.18em] text-sidebar-foreground/35">LY / 2024—25</div>
        </div>
      </aside>
      {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-foreground/25 lg:hidden" aria-label="Close navigation overlay" data-testid="button-overlay-close" />}
      <main className="min-h-[100dvh] lg:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/85 px-5 backdrop-blur-md sm:px-8 lg:px-12">
          <button onClick={() => setOpen(true)} className="rounded-xl border border-border p-2.5 lg:hidden" aria-label="Open navigation" data-testid="button-open-menu"><Menu size={19} /></button>
          <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" /> a quiet space for everyday things</div>
          <div className="ml-auto flex items-center gap-3"><span className="hidden font-mono text-[10px] tracking-[.16em] text-muted-foreground sm:block">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</span><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[12px] font-semibold text-secondary-foreground">Y</div></div>
        </header>
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</div>
      </main>
    </div>
  );
}

export function PageIntro({ eyebrow, title, detail, action }: { eyebrow: string; title: React.ReactNode; detail: string; action?: React.ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><div className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent-foreground))]">{eyebrow}</div><h1 className="font-display text-[42px] leading-[.95] tracking-[-.025em] sm:text-[54px]">{title}</h1><p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-muted-foreground">{detail}</p></div>{action}</div>;
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className = '', testId }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'quiet' | 'outline' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string; testId?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:opacity-90', quiet: 'bg-secondary/75 text-secondary-foreground hover:bg-secondary', outline: 'border border-border bg-card text-foreground hover:border-[hsl(var(--accent))]', danger: 'bg-destructive/10 text-destructive hover:bg-destructive/15' };
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} data-testid={testId}>{children}</button>;
}

export function Modal({ title, kicker, children, onClose }: { title: string; kicker?: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-[590px] overflow-y-auto rounded-[26px] border border-border bg-card p-6 shadow-2xl sm:p-8"><div className="mb-7 flex items-start justify-between gap-4"><div>{kicker && <div className="mb-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{kicker}</div>}<h2 className="font-display text-[32px] leading-none">{title}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Close dialog" data-testid="button-close-dialog"><X size={17} /></button></div>{children}</div></div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span>{children}{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</label>; }
export const inputClass = 'min-h-11 w-full rounded-xl border border-input bg-background/70 px-3.5 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.16)]';
export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border bg-card/45 px-6 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><Heart size={18} /></div><h3 className="font-display text-[25px]">{title}</h3><p className="mt-2 max-w-[330px] text-[13px] leading-relaxed text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />; }