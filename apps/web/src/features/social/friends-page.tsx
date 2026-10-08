'use client';
import type { FriendRequestDto, UserSearchResultDto } from '@ygo/shared';
import { Check, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, SectionHeading, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useRequestFriend,
  useRespondToRequest,
  useUserSearch,
} from '@/lib/api/social';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { Avatar, UserChip } from './avatar';

export function FriendsPage() {
  const t = useTranslations('social.friends');
  const [q, setQ] = useState('');
  const search = useUserSearch(useDebounced(q, 300));
  const requests = useFriendRequests();
  const friends = useFriends();

  const incoming = requests.data?.filter((r) => r.direction === 'INCOMING') ?? [];
  const outgoing = requests.data?.filter((r) => r.direction === 'OUTGOING') ?? [];

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />

      <section className="mb-10 max-w-xl space-y-3">
        <label className="block text-sm font-medium" htmlFor="friend-search">
          {t('search.label')}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            id="friend-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {q.trim().length > 0 && q.trim().length < 2 && (
          <p className="text-xs text-fg-subtle">{t('search.hint')}</p>
        )}
        {search.isFetching && <Skeleton className="h-14" />}
        {search.data?.length === 0 && (
          <p className="text-sm text-fg-muted">{t('search.noResults', { q: q.trim() })}</p>
        )}
        <ul className="space-y-2">
          {search.data?.map((result) => (
            <li key={result.id}>
              <SearchRow result={result} />
            </li>
          ))}
        </ul>
      </section>

      {incoming.length > 0 && <RequestSection title={t('requests.incoming')} requests={incoming} />}
      {outgoing.length > 0 && <RequestSection title={t('requests.outgoing')} requests={outgoing} />}

      <section>
        <SectionHeading>{t('list.title')}</SectionHeading>
        {friends.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : friends.data?.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('list.empty')}
            description={t('list.emptyDescription')}
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {friends.data?.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center gap-3 rounded-xs border border-edge px-4 py-3"
              >
                <UserChip user={friend} size="md" className="flex-1" />
                <FriendCounters
                  cards={friend.stats.distinctCards}
                  sets={friend.stats.completedSets}
                />
                <RemoveButton userId={friend.id} username={friend.username} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Deux repères de collection, alignés à droite d'une ligne d'ami. */
function FriendCounters({ cards, sets }: { cards: number; sets: number }) {
  const t = useTranslations('social.profile.stats');
  return (
    <dl className="hidden text-right text-xs text-fg-subtle sm:block">
      <div className="flex items-baseline justify-end gap-1.5">
        <dd className="font-mono tabular-nums">{cards}</dd>
        <dt className="truncate">{t('distinctCards').toLowerCase()}</dt>
      </div>
      <div className="flex items-baseline justify-end gap-1.5">
        <dd className="font-mono tabular-nums">{sets}</dd>
        <dt className="truncate">{t('completedSets').toLowerCase()}</dt>
      </div>
    </dl>
  );
}

function SearchRow({ result }: { result: UserSearchResultDto }) {
  const t = useTranslations('social.friends');
  const request = useRequestFriend();
  const respond = useRespondToRequest();

  return (
    <div className="flex items-center gap-3 rounded-xs border border-edge px-4 py-3">
      <UserChip user={result} size="md" className="flex-1" />
      {result.state === 'NONE' && (
        <Button
          size="sm"
          onClick={() => request.mutate(result.username)}
          loading={request.isPending}
        >
          <UserPlus className="size-4" />
          {t('actions.add')}
        </Button>
      )}
      {result.state === 'REQUEST_SENT' && <Badge>{t('state.REQUEST_SENT')}</Badge>}
      {result.state === 'REQUEST_RECEIVED' && result.requestId && (
        <Button
          size="sm"
          onClick={() => respond.mutate({ id: result.requestId!, accept: true })}
          loading={respond.isPending}
        >
          <Check className="size-4" />
          {t('requests.accept')}
        </Button>
      )}
      {result.state === 'FRIENDS' && <Badge tone="success">{t('state.FRIENDS')}</Badge>}
    </div>
  );
}

function RequestSection({ title, requests }: { title: string; requests: FriendRequestDto[] }) {
  const t = useTranslations('social.friends');
  const respond = useRespondToRequest();

  return (
    <section className="mb-8">
      <SectionHeading>{title}</SectionHeading>
      <ul className="space-y-2">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex items-center gap-3 rounded-xs border border-edge px-4 py-3"
          >
            <Avatar user={req.user} size="md" />
            <UserChip user={req.user} className="flex-1" />
            {req.direction === 'INCOMING' ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ id: req.id, accept: true })}
                  loading={respond.isPending}
                >
                  <Check className="size-4" />
                  {t('requests.accept')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => respond.mutate({ id: req.id, accept: false })}
                >
                  <X className="size-4" />
                  {t('requests.decline')}
                </Button>
              </div>
            ) : (
              <RemoveButton
                userId={req.user.id}
                username={req.user.username}
                label={t('requests.cancel')}
                skipConfirm
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Retirer un ami ou annuler une demande : même route côté serveur. Une confirmation pour
 * l'amitié (on perd l'accès au profil), aucune pour une demande qu'on vient d'envoyer.
 */
export function RemoveButton({
  userId,
  username,
  label,
  skipConfirm,
}: {
  userId: string;
  username: string;
  label?: string;
  skipConfirm?: boolean;
}) {
  const t = useTranslations('social.friends');
  const remove = useRemoveFriend();

  return (
    <Button
      size={label ? 'sm' : 'icon'}
      variant="ghost"
      loading={remove.isPending}
      aria-label={label ?? t('actions.remove')}
      title={label ?? t('actions.remove')}
      onClick={() => {
        if (skipConfirm || window.confirm(t('actions.confirmRemove', { username }))) {
          remove.mutate(userId);
        }
      }}
    >
      <UserMinus className="size-4" />
      {label}
    </Button>
  );
}
