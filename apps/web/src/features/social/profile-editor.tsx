'use client';
import { MAX_PROFILE_CARDS, usernameSchema, type PublicUserDto } from '@ygo/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { useCollection, type CollectionItemDto } from '@/lib/api/collection';
import {
  imageUrl,
  useRemoveProfileImage,
  useSetProfileCards,
  useUpdateProfile,
  useUploadProfileImage,
} from '@/lib/api/social';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';

/** Pseudo, photo de profil et bannière. Trois réglages, donc une modale et pas une page. */
export function ProfileEditor({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: PublicUserDto;
}) {
  const t = useTranslations('social.profile');
  const [username, setUsername] = useState(user.username);
  const update = useUpdateProfile();

  const parsed = usernameSchema.safeParse(username);
  const changed = username.trim() !== user.username;
  const issue = changed && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  return (
    <Dialog open={open} onClose={onClose} title={t('edit')}>
      <div className="space-y-6 px-5 py-5">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!changed || !parsed.success) return;
            update.mutate({ username: parsed.data }, { onSuccess: onClose });
          }}
        >
          <Field label={t('username')} hint={t('usernameHint')} error={issue}>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={20}
              autoComplete="off"
            />
          </Field>
          {update.error && <p className="text-sm text-danger">{(update.error as Error).message}</p>}
          <Button type="submit" size="sm" disabled={!changed || !!issue} loading={update.isPending}>
            {t('save')}
          </Button>
        </form>

        <ImageField kind="avatar" label={t('avatar')} current={user.avatarUrl} />
        <ImageField kind="banner" label={t('banner')} current={user.bannerUrl} />
        <p className="text-xs text-fg-subtle">{t('imageHint')}</p>
      </div>
    </Dialog>
  );
}

function ImageField({
  kind,
  label,
  current,
}: {
  kind: 'avatar' | 'banner';
  label: string;
  current: string | null;
}) {
  const t = useTranslations('social.profile');
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadProfileImage();
  const remove = useRemoveProfileImage();
  const url = imageUrl(current);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'relative overflow-hidden border border-border bg-bg-sunken',
            kind === 'avatar' ? 'size-16 rounded-full' : 'h-16 w-40 rounded-lg',
          )}
        >
          {url && <Image src={url} alt="" fill sizes="160px" className="object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => input.current?.click()}
            loading={upload.isPending}
          >
            <ImagePlus className="size-4" />
            {url ? t('replace') : t('upload')}
          </Button>
          {url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove.mutate(kind)}
              loading={remove.isPending}
            >
              <Trash2 className="size-4" />
              {t('remove')}
            </Button>
          )}
        </div>
      </div>
      {upload.error && <p className="text-sm text-danger">{(upload.error as Error).message}</p>}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Réinitialiser la valeur : renvoyer le même fichier doit relancer un envoi
          event.target.value = '';
          if (file) upload.mutate({ kind, file });
        }}
      />
    </div>
  );
}

/**
 * Impressions proposables : celles qu'on possède, une seule fois chacune. La collection peut
 * porter plusieurs lignes pour la même impression (langue, état), qui donneraient des
 * vignettes identiques dont la sélection de l'une ferait réagir l'autre.
 */
function pickable(items: CollectionItemDto[] | undefined): CollectionItemDto[] {
  const seen = new Set<string>();
  return (items ?? []).filter((item) => {
    // Sans impression, la ligne ne peut pas être mise en avant : le profil montre une
    // édition précise, pas « la carte, quelque part ».
    if (!item.print || seen.has(item.print.id)) return false;
    seen.add(item.print.id);
    return true;
  });
}

/**
 * Choix des cartes mises en avant, dans sa propre collection. On envoie la liste entière à
 * chaque validation : réordonner est alors la même opération qu'ajouter, et l'ordre affiché
 * est exactement celui qu'on a cliqué.
 */
export function ShowcasePicker({
  open,
  onClose,
  selected,
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
}) {
  const t = useTranslations('social.profile.showcase');
  const [picked, setPicked] = useState<string[]>(selected);
  const [q, setQ] = useState('');
  const save = useSetProfileCards();
  const collection = useCollection({ page: 1, pageSize: 60, q: useDebounced(q, 300) || undefined });

  const toggle = (printId: string) =>
    setPicked((before) =>
      before.includes(printId)
        ? before.filter((id) => id !== printId)
        : before.length >= MAX_PROFILE_CARDS
          ? before
          : [...before, printId],
    );

  return (
    <Dialog open={open} onClose={onClose} title={t('dialogTitle')} variant="sheet">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-border px-5 py-4">
          <p className="text-sm text-fg-muted">{t('dialogHint', { max: MAX_PROFILE_CARDS })}</p>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t('search')}
            autoComplete="off"
          />
          <Badge tone={picked.length >= MAX_PROFILE_CARDS ? 'warning' : 'neutral'}>
            {t('selected', { count: picked.length, max: MAX_PROFILE_CARDS })}
          </Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {collection.isPending ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-(--aspect-card)" />
              ))}
            </div>
          ) : collection.data?.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-muted">{t('noResults')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {pickable(collection.data?.items).map((item) => {
                const printId = item.print!.id;
                const index = picked.indexOf(printId);
                return (
                  <li key={printId}>
                    <button
                      onClick={() => toggle(printId)}
                      className="group relative block w-full text-left"
                      aria-pressed={index >= 0}
                    >
                      <CardImage
                        card={item.card}
                        sizes="(max-width: 640px) 33vw, 160px"
                        className={cn(
                          'transition',
                          index >= 0 ? 'ring-2 ring-accent' : 'group-hover:brightness-110',
                        )}
                      />
                      {index >= 0 && (
                        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-accent-fg">
                          {index + 1}
                        </span>
                      )}
                      <p className="mt-1 truncate font-mono text-[10px] text-fg-subtle">
                        {item.print!.printCode}
                      </p>
                      {/* La rareté, toujours : c'est elle qui distingue deux impressions
                          de la même carte, donc elle qu'on choisit ici. */}
                      <p className="truncate text-[11px] text-fg-muted">{item.print!.rarity}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          {save.error && (
            <p className="mr-auto text-sm text-danger">{(save.error as Error).message}</p>
          )}
          <Button
            loading={save.isPending}
            onClick={() => save.mutate(picked, { onSuccess: onClose })}
          >
            {t('done')}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
