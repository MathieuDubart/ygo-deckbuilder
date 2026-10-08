'use client';
import type { FriendSetProgressDto, PublicUserDto } from '@ygo/shared';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Meter } from '@/components/ui/feedback';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, UserChip } from './avatar';

const counters = (row: FriendSetProgressDto, anyEdition: boolean) =>
  anyEdition
    ? { owned: row.ownedCards, total: row.cards }
    : { owned: row.ownedPrints, total: row.prints };

/**
 * Comparaison compacte, pour une vignette d'extension : quelques avatars et un pourcentage.
 * Volontairement muette quand personne n'a commencé — une ligne « aucun ami » répétée sur
 * trente vignettes ne dit rien.
 */
export function FriendProgressStrip({
  friends,
  anyEdition,
  className,
}: {
  friends: FriendSetProgressDto[] | undefined;
  anyEdition: boolean;
  className?: string;
}) {
  const { percent } = useFormat();
  if (!friends?.length) return null;

  return (
    <div className={cn('flex items-center gap-1.5 overflow-hidden', className)}>
      <Users className="size-3 shrink-0 text-fg-subtle" />
      {friends.slice(0, 3).map((row) => {
        const { owned, total } = counters(row, anyEdition);
        return (
          <span
            key={row.user.id}
            className="flex min-w-0 items-center gap-1"
            title={`${row.user.username} · ${owned}/${total}`}
          >
            <Avatar user={row.user} size="xs" />
            <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
              {percent(total ? owned / total : 0)}
            </span>
          </span>
        );
      })}
      {friends.length > 3 && (
        <span className="font-mono text-[10px] text-fg-subtle">+{friends.length - 3}</span>
      )}
    </div>
  );
}

/** Comparaison détaillée, pour la fiche d'une extension : une barre par ami. */
export function FriendProgressPanel({
  friends,
  anyEdition,
}: {
  friends: FriendSetProgressDto[];
  anyEdition: boolean;
}) {
  const t = useTranslations('social.releases');
  const { number, percent } = useFormat();

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-fg-muted">{t('onThisSet')}</h3>
      {friends.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('nobodyStarted')}</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((row) => {
            const { owned, total } = counters(row, anyEdition);
            return (
              <li key={row.user.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <UserChip user={row.user} />
                  <span className="font-mono text-xs tabular-nums text-fg-muted">
                    {number(owned)} / {number(total)} · {percent(total ? owned / total : 0)}
                  </span>
                </div>
                <Meter value={owned} total={total} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Qui, parmi les amis, possède cette impression. Sur une vignette de carte : des avatars
 * empilés, pleins pour l'impression exacte, cerclés pour une autre édition — la même
 * distinction que les pastilles de sa propre collection.
 */
export function PrintOwners({
  owners,
  elsewhere,
  byId,
}: {
  owners: string[] | undefined;
  elsewhere: string[] | undefined;
  byId: Map<string, PublicUserDto>;
}) {
  const t = useTranslations('social.releases');
  const exact = (owners ?? []).flatMap((id) => byId.get(id) ?? []);
  const other = (elsewhere ?? []).flatMap((id) => byId.get(id) ?? []);
  if (exact.length === 0 && other.length === 0) return null;

  const label = [
    exact.length > 0 ? t('ownedBy', { count: exact.length }) : null,
    other.length > 0 ? t('ownedElsewhere', { count: other.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className="flex items-center gap-0.5" title={label} aria-label={label}>
      {exact.slice(0, 3).map((user) => (
        <Avatar key={user.id} user={user} size="xs" className="ring-1 ring-success" />
      ))}
      {other.slice(0, 3).map((user) => (
        <Avatar key={user.id} user={user} size="xs" className="opacity-60 ring-1 ring-warning" />
      ))}
    </span>
  );
}
