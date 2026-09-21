'use client';
import { DECK_FORMATS, type DeckFormat } from '@ygo/shared';
import { FileUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useCreateDeck, useImportYdk } from '@/lib/api/decks';
import { cn } from '@/lib/utils';

/** Nouveau deck : vide, ou importé depuis un .ydk (EDOPro, YGO Omega, Master Duel exports…). */
export function NewDeckDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateDeck();
  const importYdk = useImportYdk();
  const [mode, setMode] = useState<'empty' | 'ydk'>('empty');
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('TCG');
  const [content, setContent] = useState('');

  const go = (id: string) => {
    onClose();
    router.push(`/decks/${id}`);
  };
  const error = (mode === 'empty' ? create.error : importYdk.error)?.message;

  return (
    <Dialog open={open} onClose={onClose} title="Nouveau deck">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'empty') create.mutate({ name, format }, { onSuccess: (d) => go(d.id) });
          else importYdk.mutate({ name, format, content }, { onSuccess: (d) => go(d.id) });
        }}
      >
        <div className="grid grid-cols-2 rounded-lg border border-border bg-bg-sunken p-0.5 text-sm">
          {(['empty', 'ydk'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md py-1.5 font-medium',
                mode === m ? 'bg-bg-elevated shadow-sm' : 'text-fg-muted',
              )}
            >
              {m === 'empty' ? 'Deck vide' : 'Importer un .ydk'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Nom">
            <Input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)}>
              {DECK_FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </Field>
        </div>
        {mode === 'ydk' && (
          <Field label="Fichier .ydk" hint="Choisis un fichier ou colle son contenu.">
            <input
              type="file"
              accept=".ydk,text/plain"
              className="text-sm text-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-bg-sunken file:px-3 file:py-1.5 file:text-fg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setContent(await file.text());
                if (!name) setName(file.name.replace(/\.ydk$/i, ''));
              }}
            />
            <Textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="#main…"
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={create.isPending || importYdk.isPending}
          disabled={!name || (mode === 'ydk' && !content)}
        >
          {mode === 'ydk' && <FileUp className="size-4" />}
          {mode === 'empty' ? 'Créer et construire' : 'Importer'}
        </Button>
      </form>
    </Dialog>
  );
}
