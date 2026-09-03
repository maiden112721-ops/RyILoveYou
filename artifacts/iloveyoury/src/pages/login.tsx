import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Heart, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useLogin } from '@workspace/api-client-react';
import { LogoMark, Button, inputClass } from '@/components/app-shell';

export default function Login() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useLogin();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    login.mutate({ data: { password } }, { onSuccess: () => setLocation('/'), onError: () => setError('That passphrase didn’t open the door. Try again, gently.') });
  };
  return <div className="min-h-[100dvh] overflow-hidden bg-primary text-primary-foreground">
    <div className="absolute inset-0 soft-grid opacity-[.12]" />
    <div className="relative mx-auto flex min-h-[100dvh] max-w-[1240px] flex-col px-6 py-7 sm:px-10 lg:flex-row lg:items-center lg:gap-24 lg:py-10">
      <div className="flex flex-1 flex-col justify-between lg:min-h-[680px]">
        <LogoMark />
        <div className="mt-24 max-w-[540px] lg:mt-0 fade-up">
          <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.24em] text-primary-foreground/55"><span className="h-px w-8 bg-accent" /> private access</div>
          <h1 className="font-display text-[64px] leading-[.88] tracking-[-.03em] sm:text-[92px]">A small place<br /><em>for us.</em></h1>
          <p className="mt-8 max-w-[390px] text-[15px] leading-relaxed text-primary-foreground/65">Letters, plans, and the little money things — kept close, kept simple.</p>
        </div>
        <div className="mt-20 hidden items-center gap-3 text-[12px] text-primary-foreground/45 lg:flex"><ShieldCheck size={15} /> private by design <span className="mx-1 text-primary-foreground/20">/</span> one person only</div>
      </div>
      <div className="mt-16 w-full max-w-[440px] self-center rounded-[28px] bg-card p-7 text-card-foreground shadow-2xl sm:p-10 lg:mt-0 fade-up-2">
        <div className="mb-9"><div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-secondary text-secondary-foreground"><Heart size={19} fill="currentColor" /></div><h2 className="font-display text-[34px] leading-none">Come on in.</h2><p className="mt-3 text-[13px] text-muted-foreground">This space has one key. You know it.</p></div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Passphrase</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 text-muted-foreground" size={17} /><input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pl-11`} placeholder="The secret word" data-testid="input-login-password" /></div></label>
          {error && <div className="rounded-xl bg-destructive/10 px-3.5 py-3 text-[12px] text-destructive" role="alert" data-testid="status-login-error">{error}</div>}
          <Button type="submit" disabled={login.isPending || !password} className="w-full" testId="button-login">{login.isPending ? 'Checking...' : <>Open our space <ArrowRight size={16} /></>}</Button>
        </form>
        <p className="mt-8 text-center font-mono text-[10px] tracking-[.12em] text-muted-foreground/70">NO ACCOUNTS · NO NOISE · JUST HERE</p>
      </div>
    </div>
  </div>;
}