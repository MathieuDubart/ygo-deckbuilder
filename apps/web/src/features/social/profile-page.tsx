'use client';
import type { ProfileCardDto, ProfileDto, ProfileViewDto } from '@ygo/shared';
import { Check, Lock, Pencil, Sparkles, UserPlus, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CardDetailDialog } from '@/components/cards/card-detail-dialog';
import { CardImage } from '@/components/cards/card-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Figures, SectionHeading, Skeleton, Stat } from '@/components/ui/feedback';
import { imageUrl, useProfile, useRequestFriend, useRespondToRequest } from '@/lib/api/social';
import { Avatar } from './avatar';
import { RemoveButton } from './friends-page';
import { ProfileEditor, ShowcasePicker } from './profile-editor';

/**
 * Un profil, le sien ou celui d'un ami. Le serveur décide de ce qui est visible
 * (`ProfileViewDto` est une union) : la page n'a qu'à traiter les deux cas.
 */
export function ProfilePage({ username }: { username?: string }) {
  const { data, isPending, error } = useProfile(username);
  const t = useTranslations('social.profile');

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (error || !data) {
    return <EmptyState icon={Users} title={t('hidden.title')} />;
  }
  return data.visible ? <VisibleProfile profile={data} /> : <HiddenProfile profile={data} />;
}

function VisibleProfile({ profile }: { profile: ProfileDto & { visible: true } }) {
  const t = useTranslations('social.profile');
  const format = useFormatter();
  const isSelf = profile.state === 'SELF';
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  return (
    <>
      <Banner profile={profile} />

      {/* L'avatar déborde de la bannière : le titre doit lui laisser la place */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-14 md:pt-4 md:pl-34">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {profile.user.username}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {profile.friendsSince
              ? t('friendsSince', { date: format.dateTime(new Date(profile.friendsSince)) })
              : t('memberSince', { date: format.dateTime(new Date(profile.memberSince)) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSelf ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                {t('edit')}
              </Button>
              <Link href="/friends">
                <Button variant="secondary">
                  <Users className="size-4" />
                  {t('friendCount', { count: profile.friendCount })}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Badge tone="success">{t('friendCount', { count: profile.friendCount })}</Badge>
              <RemoveButton userId={profile.user.id} username={profile.user.username} />
            </>
          )}
        </div>
      </div>

      <Figures>
        <Stat label={t('stats.distinctCards')} value={profile.stats.distinctCards} />
        <Stat label={t('stats.copies')} value={profile.stats.copies} />
        <Stat label={t('stats.sets')} value={profile.stats.sets} />
        {/* Une extension bouclée se mérite : c'est l'un des deux endroits où l'or sert */}
        <Stat
          label={t('stats.completedSets')}
          value={profile.stats.completedSets}
          tone={profile.stats.completedSets > 0 ? 'gold' : undefined}
        />
      </Figures>

      <section>
        <SectionHeading
          action={
            isSelf && (
              <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
                <Sparkles className="size-4" />
                {t('showcase.choose')}
              </Button>
            )
          }
        >
          {t('showcase.title')}
        </SectionHeading>
        {profile.cards.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={
              isSelf
                ? t('showcase.empty')
                : t('showcase.emptyOther', { username: profile.user.username })
            }
            description={isSelf ? t('showcase.emptyHint') : undefined}
          />
        ) : (
          <Showcase cards={profile.cards} />
        )}
      </section>

      {isSelf && (
        <>
          <ProfileEditor open={editing} onClose={() => setEditing(false)} user={profile.user} />
          <ShowcasePicker
            open={picking}
            onClose={() => setPicking(false)}
            selected={profile.cards.map((card) => card.printId)}
          />
        </>
      )}
    </>
  );
}

/**
 * Bannière + avatar, le bloc d'identité. Sans bannière, un dégradé plutôt qu'un trou.
 * L'avatar est posé À CÔTÉ de la bannière et non dedans : `overflow-hidden`, nécessaire pour
 * arrondir l'image, lui couperait la moitié basse.
 */
function Banner({ profile }: { profile: ProfileDto }) {
  const banner = imageUrl(profile.user.bannerUrl);
  return (
    <div className="relative">
      <div className="h-32 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/25 via-bg-elevated to-bg-sunken md:h-44">
        {banner && (
          <Image
            src={banner}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 80rem"
            className="object-cover"
            priority
          />
        )}
      </div>
      <div className="absolute -bottom-10 left-4 rounded-full ring-4 ring-bg md:left-6">
        <Avatar user={profile.user} size="lg" />
      </div>
    </div>
  );
}

function Showcase({ cards }: { cards: ProfileCardDto[] }) {
  const [open, setOpen] = useState<ProfileCardDto | null>(null);
  return (
    <>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {cards.map((card) => (
          <li key={card.printId}>
            <button
              onClick={() => setOpen(card)}
              className="group block w-full text-left"
              title={`${card.card.name} · ${card.printCode}`}
            >
              <span className="pocket block rounded-xs p-1">
                <CardImage
                  card={card.card}
                  sizes="(max-width: 640px) 33vw, 180px"
                  className="transition group-hover:brightness-110"
                />
              </span>
              <p className="mt-1 truncate font-mono text-[10px] text-fg-subtle">{card.printCode}</p>
              <p className="truncate text-[11px] text-fg-muted">{card.rarity}</p>
            </button>
          </li>
        ))}
      </ul>
      {/* L'impression exacte, pas seulement la carte : c'est celle-là qu'il possède */}
      <CardDetailDialog
        cardId={open?.card.id ?? null}
        printCodeHint={open?.printCode}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/** Profil d'un compte qui n'est pas ami : de quoi l'ajouter, et rien d'autre. */
function HiddenProfile({ profile }: { profile: ProfileViewDto & { visible: false } }) {
  const t = useTranslations('social.profile');
  const tf = useTranslations('social.friends');
  const request = useRequestFriend();
  const respond = useRespondToRequest();
  const { user, state, requestId } = profile;

  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <div className="mb-4 flex justify-center">
        <Avatar user={user} size="lg" />
      </div>
      <h1 className="text-xl font-semibold">{user.username}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10">
        <Lock className="mx-auto size-7 text-fg-subtle" strokeWidth={1.5} />
        <p className="mt-3 font-medium">{t('hidden.title')}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">
          {state === 'REQUEST_SENT'
            ? t('hidden.sent')
            : state === 'REQUEST_RECEIVED'
              ? t('hidden.received', { username: user.username })
              : t('hidden.description', { username: user.username })}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {state === 'NONE' && (
            <Button onClick={() => request.mutate(user.username)} loading={request.isPending}>
              <UserPlus className="size-4" />
              {tf('actions.add')}
            </Button>
          )}
          {state === 'REQUEST_RECEIVED' && requestId && (
            <Button
              onClick={() => respond.mutate({ id: requestId, accept: true })}
              loading={respond.isPending}
            >
              <Check className="size-4" />
              {tf('requests.accept')}
            </Button>
          )}
          {state === 'REQUEST_SENT' && (
            <RemoveButton
              userId={user.id}
              username={user.username}
              label={tf('requests.cancel')}
              skipConfirm
            />
          )}
        </div>
      </div>
    </div>
  );
}
