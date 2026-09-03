import { useMemo, useState } from 'react';
import { LockKeyhole, MoreHorizontal, Pencil, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListLettersQueryKey, useCreateLetter, useDeleteLetter, useListLetters, useUnlockLetters, useUpdateLetter } from '@workspace/api-client-react';
import type { Letter } from '@workspace/api-client-react';
import { AppShell, AuthGate, Button, EmptyState, Field, Modal, PageIntro, Skeleton, inputClass } from '@/components/app-shell';

const dateLong = (v: string) => new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

function LetterForm({ letter, onClose, unlocked }: { letter?: Letter; onClose: () => void; unlocked: boolean }) {
  const queryClient = useQueryClient();
  const create = useCreateLetter();
  const update = useUpdateLetter();
  const [title, setTitle] = useState(letter?.title ?? '');
  const [content, setContent] = useState(letter?.content ?? '');
  const [tags, setTags] = useState(letter?.tags.join(', ') ?? '');
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { title, content, tags: tags.split(',').map(x => x.trim()).filter(Boolean) };
    setError('');
    if (letter) update.mutate({ id: letter.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLettersQueryKey() }); onClose(); }, onError: () => setError('Couldn’t save that letter just yet.') });
    else create.mutate({ data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLettersQueryKey() }); onClose(); }, onError: () => setError('Couldn’t save that letter just yet.') });
  };
  return <Modal title={letter ? 'Edit the letter' : 'Write something down'} kicker={letter ? 'a small revision' : 'new from the heart'} onClose={onClose}><form onSubmit={submit} className="space-y-5">
    {!unlocked && <div className="flex gap-3 rounded-xl bg-secondary/70 p-3.5 text-[12px] text-secondary-foreground"><LockKeyhole size={16} className="mt-0.5 shrink-0" /> This space is unlocked for this visit. It will close itself when you leave.</div>}
    <Field label="Title"><input required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="A thought worth keeping" data-testid="input-letter-title" /></Field>
    <Field label="Letter" hint="Use the toolbar for the feeling, or just start typing."><div className="overflow-hidden rounded-xl border border-input bg-background/70 focus-within:border-[hsl(var(--accent))] focus-within:ring-2 focus-within:ring-[hsl(var(--accent)/.16)]"><div className="flex gap-1 border-b border-border p-2"><button type="button" onClick={() => document.execCommand('bold')} className="rounded-lg px-3 py-1.5 text-[12px] font-bold hover:bg-muted" data-testid="button-editor-bold">B</button><button type="button" onClick={() => document.execCommand('italic')} className="rounded-lg px-3 py-1.5 font-display text-[14px] italic hover:bg-muted" data-testid="button-editor-italic">I</button><span className="ml-auto px-2 py-1.5 text-[10px] text-muted-foreground">rich text</span></div><div contentEditable suppressContentEditableWarning onInput={e => setContent(e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: content }} data-placeholder="Write it as it comes..." className="min-h-[180px] p-4 text-[14px] leading-relaxed outline-none" data-testid="editor-letter-content" /></div></Field>
    <Field label="Tags" hint="Separate with commas"><input value={tags} onChange={e => setTags(e.target.value)} className={inputClass} placeholder="home, us, remember" data-testid="input-letter-tags" /></Field>
    {error && <p className="rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive" data-testid="status-letter-error">{error}</p>}
    <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose} testId="button-cancel-letter">Not now</Button><Button type="submit" disabled={pending || !title.trim() || !plain(content).trim()} testId="button-save-letter">{pending ? 'Saving...' : 'Save letter'}</Button></div>
  </form></Modal>;
}

function PinModal({ onUnlocked, onClose }: { onUnlocked: () => void; onClose: () => void }) {
  const unlock = useUnlockLetters();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return <Modal title="A little privacy check" kicker="letters are personal" onClose={onClose}><form onSubmit={e => { e.preventDefault(); setError(''); unlock.mutate({ data: { pin } }, { onSuccess: onUnlocked, onError: () => setError('That PIN didn’t work. Take another look.') }); }} className="space-y-5"><p className="text-[14px] leading-relaxed text-muted-foreground">Enter the PIN to open the writing desk. Once open, you can create or edit letters until this visit ends.</p><input autoFocus inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} className={`${inputClass} text-center text-[20px] tracking-[.5em]`} placeholder="••••" data-testid="input-letters-pin" />{error && <p className="rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive" data-testid="status-pin-error">{error}</p>}<Button type="submit" className="w-full" disabled={unlock.isPending || !pin} testId="button-unlock-letters">{unlock.isPending ? 'Checking...' : 'Unlock letters'}</Button></form></Modal>;
}

export default function Feed() {
  const letters = useListLetters();
  const remove = useDeleteLetter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [modal, setModal] = useState<'pin' | 'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Letter>();
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => (letters.data ?? []).filter(l => `${l.title} ${plain(l.content)} ${l.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())), [letters.data, search]);
  const startCreate = () => unlocked ? setModal('create') : setModal('pin');
  return <AuthGate><AppShell><PageIntro eyebrow="the feed / words kept close" title={<>Letters<br /><em>for later.</em></>} detail="A chronological little archive for the things you meant to say, remember, or hold onto." action={<Button onClick={startCreate} testId="button-new-letter"><Plus size={16} /> New letter</Button>} />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-[360px] flex-1"><Search className="absolute left-3.5 top-3.5 text-muted-foreground" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} pl-10`} placeholder="Search the archive" data-testid="input-search-letters" /></div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{letters.data?.length ?? 0} letters / private</div></div>
    {notice && <div className="mb-5 rounded-xl bg-[hsl(var(--chart-5)/.14)] px-4 py-3 text-[12px] text-[hsl(var(--chart-5))]" data-testid="status-letter-success">{notice}</div>}
    {letters.isLoading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div> : letters.isError ? <div className="rounded-2xl bg-destructive/10 p-6 text-[13px] text-destructive" data-testid="status-letters-error">The feed is taking a quiet moment. Refresh to try again.</div> : filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((letter, i) => <article key={letter.id} className="group flex min-h-[255px] flex-col rounded-[22px] border border-border bg-card p-6 transition-transform hover:-translate-y-1" data-testid={`card-letter-${letter.id}`}><div className="mb-7 flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent/30 font-mono text-[10px] text-accent-foreground"><Pin size={14} /></span><div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button onClick={() => { setSelected(letter); unlocked ? setModal('edit') : setModal('pin'); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${letter.title}`} data-testid={`button-edit-letter-${letter.id}`}><Pencil size={14} /></button><button onClick={() => { if (window.confirm('Delete this letter?')) remove.mutate({ id: letter.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLettersQueryKey() }); setNotice('Letter tucked away.'); } }); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${letter.title}`} data-testid={`button-delete-letter-${letter.id}`}><Trash2 size={14} /></button></div></div><h2 className="font-display text-[29px] leading-[1.02]">{letter.title}</h2><p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{plain(letter.content)}</p><div className="mt-auto flex items-end justify-between gap-3 pt-6"><div className="flex flex-wrap gap-1.5">{letter.tags.slice(0, 3).map(tag => <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">#{tag}</span>)}</div><time className="shrink-0 font-mono text-[10px] text-muted-foreground">{dateLong(letter.createdAt)}</time></div></article>)}</div> : <EmptyState title={search ? 'Nothing found' : 'The first page is yours'} detail={search ? 'Try another word or clear the search.' : 'Write something small. It does not need to be important to belong here.'} action={!search && <Button onClick={startCreate} testId="button-empty-new-letter"><Plus size={16} /> Write a letter</Button>} />}
    {modal === 'pin' && <PinModal onClose={() => setModal(null)} onUnlocked={() => { setUnlocked(true); setModal(selected ? 'edit' : 'create'); }} />}{modal === 'create' && <LetterForm onClose={() => setModal(null)} unlocked={unlocked} />}{modal === 'edit' && selected && <LetterForm letter={selected} onClose={() => setModal(null)} unlocked={unlocked} />}
  </AppShell></AuthGate>;
}