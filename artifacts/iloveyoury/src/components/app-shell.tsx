import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useGetSession, useHealthCheck, useLogout } from '@workspace/api-client-react';
import { CalendarDays, Heart, LogOut, PenLine, WalletCards, X } from 'lucide-react';

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
  { href: '/feed', label: 'Feed', icon: PenLine, tulip: true },
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
  const [location] = useLocation();
  const logout = useLogout();
  const { data: health } = useHealthCheck({ query: { staleTime: 60000, queryKey: getHealthCheckQueryKey() } });
  const [, setLocation] = useLocation();
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => setLocation('/login') });
  return (
    <div className="min-h-[100dvh] bg-background text-foreground paper-texture">
      <header className="sticky top-0 z-20 border-b border-border/45 bg-background/88 px-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex min-h-[72px] max-w-[1280px] items-center gap-4">
          <LogoMark />
          <nav className="ml-auto flex items-center gap-1.5" aria-label="Primary navigation">
            {nav.map(({ href, label, icon: Icon, tulip }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors sm:px-4 ${location === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}>
                {tulip && <span aria-hidden="true">🌷</span>}
                <Icon size={16} strokeWidth={location === href ? 2.2 : 1.7} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 border-l border-border/50 pl-4 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${health?.status === 'ok' ? 'bg-[hsl(var(--accent))]' : 'bg-muted-foreground/40'}`} aria-label="Service status" />
            <button onClick={handleLogout} disabled={logout.isPending} className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={logout.isPending ? 'Closing space' : 'Close space'} data-testid="button-logout"><LogOut size={16} /></button>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100dvh-72px)]">
        <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</div>
      </main>
    </div>
  );
}

export function PageIntro({ eyebrow, title, detail, action }: { eyebrow: string; title: React.ReactNode; detail: string; action?: React.ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><div className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent-foreground))]">{eyebrow}</div><h1 className="font-display text-[42px] leading-[.95] tracking-[-.025em] sm:text-[54px]">{title}</h1><p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-muted-foreground">{detail}</p></div>{action}</div>;
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className = '', testId }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'quiet' | 'outline' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string; testId?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:opacity-90', quiet: 'bg-secondary/75 text-secondary-foreground hover:bg-secondary', outline: 'bg-card/70 text-foreground ring-1 ring-border/70 hover:ring-[hsl(var(--accent))]', danger: 'bg-destructive/10 text-destructive hover:bg-destructive/15' };
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} data-testid={testId}>{children}</button>;
}

export function Modal({ title, kicker, children, onClose }: { title: string; kicker?: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-[590px] overflow-y-auto rounded-[24px] bg-card p-6 shadow-2xl sm:p-8"><div className="mb-7 flex items-start justify-between gap-4"><div>{kicker && <div className="mb-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{kicker}</div>}<h2 className="font-display text-[32px] leading-none">{title}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Close dialog" data-testid="button-close-dialog"><X size={17} /></button></div>{children}</div></div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span>{children}{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</label>; }
export const inputClass = 'min-h-11 w-full rounded-xl bg-background/70 px-3.5 text-[14px] outline-none ring-1 ring-border/70 transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-[hsl(var(--accent)/.45)]';
export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border bg-card/45 px-6 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><Heart size={18} /></div><h3 className="font-display text-[25px]">{title}</h3><p className="mt-2 max-w-[330px] text-[13px] leading-relaxed text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />; }