'use client';
import type { AdminRunnableSync, AdminSyncDto, AdminUserDto } from '@ygo/shared';
import {
  AlertTriangle,
  Check,
  Database,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/features/social/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FacetBar, SortSelect } from '@/components/ui/facet-bar';
import {
  EmptyState,
  Figures,
  PageHeader,
  Pagination,
  Skeleton,
  Stat,
} from '@/components/ui/feedback';
import { DividerTabs } from '@/components/ui/tabs';
import {
  useAdminOverview,
  useAdminUsers,
  useRunSync,
  useSetUserRole,
  type AdminUsersParams,
} from '@/lib/api/admin';
import { useMe } from '@/lib/api/auth';
import { useFormat } from '@/lib/format';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { cn } from '@/lib/utils';

type Tab = 'users' | 'syncs' | 'instance';
const SORTS = ['recent', 'name', 'cards', 'decks'] as const;

/**
 * Panneau d'administration de l'instance.
 *
 * Il n'est pas la sécurité : l'API refuse tout à un compte ordinaire, et c'est elle qui
 * décide. Cacher le lien dans la barre latérale est une politesse d'interface, pas une
 * barrière — un panneau qui ne se montrerait pas mais répondrait quand même ne protégerait
 * personne.
 */
export function AdminPage() {
  const t = useTranslations('admin');
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>('users');

  // L'API refuse déjà tout à un compte ordinaire, mais sans ça la page lui montrerait la
  // coquille du panneau et une liste vide — ce qui se lit « il n'y a aucun compte » plutôt
  // que « ce n'est pas pour toi ». Un écran ne doit pas laisser croire autre chose que ce
  // qui se passe.
  if (isLoading) return <Skeleton className="h-64" />;
  if (me?.role !== 'ADMIN') {
    return <EmptyState icon={ShieldOff} title={t('denied.title')} description={t('denied.hint')} />;
  }

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <DividerTabs
        label={t('tabs.label')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'users', label: t('tabs.users'), icon: Users },
          { value: 'syncs', label: t('tabs.syncs'), icon: RefreshCw },
          { value: 'instance', label: t('tabs.instance'), icon: Database },
        ]}
        className="mb-5"
      />
      {tab === 'users' && <UsersTab />}
      {tab === 'syncs' && <SyncsTab />}
      {tab === 'instance' && <InstanceTab />}
    </>
  );
}

function UsersTab() {
  const t = useTranslations('admin');
  const tf = useTranslations('collection.filters');
  const [q, setQ] = useState('');
  const [params, setParams] = useState<AdminUsersParams>({ page: 1, pageSize: 25 });
  const { data, isLoading } = useAdminUsers({ ...params, q: useDebounced(q) || undefined });
  const set = (patch: AdminUsersParams) => setParams((p) => ({ ...p, page: 1, ...patch }));

  return (
    <>
      <FacetBar
        className="mb-4"
        search={{ value: q, placeholder: t('users.search'), onChange: setQ }}
        facets={[
          {
            key: 'role',
            label: t('users.role'),
            allLabel: t('users.allRoles'),
            value: params.role,
            options: (['ADMIN', 'USER'] as const).map((value) => ({
              value,
              label: t(`roles.${value}`),
            })),
            onChange: (value) => set({ role: value as AdminUsersParams['role'] }),
          },
        ]}
      >
        <SortSelect
          label={tf('sort')}
          value={params.sort ?? 'recent'}
          onChange={(value) => set({ sort: value as AdminUsersParams['sort'] })}
          options={SORTS.map((value) => ({
            value,
            label: tf('sortOption', { label: t(`users.sorts.${value}`) }),
          }))}
        />
      </FacetBar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState icon={Users} title={t('users.none')} description={t('users.noneHint')} />
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => setParams((p) => ({ ...p, page }))}
          />
        </>
      )}
    </>
  );
}

function UserRow({ user }: { user: AdminUserDto }) {
  const t = useTranslations('admin');
  const { date, number } = useFormat();
  const { data: me } = useMe();
  const setRole = useSetUserRole();
  const isAdmin = user.role === 'ADMIN';
  // Deux raisons de ne pas proposer la rétrogradation, et l'interface les dit plutôt que
  // de laisser l'appel échouer : on ne se ferme pas la porte, et le compte d'ADMIN_EMAIL
  // reprendrait son rôle à la connexion suivante.
  const locked = isAdmin && (user.id === me?.id || user.pinnedByEnv);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-bg-elevated px-4 py-3">
      <Avatar user={user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          {user.username}
          {isAdmin && <Badge tone="success">{t('roles.ADMIN')}</Badge>}
          {user.pinnedByEnv && <Badge tone="gold">{t('users.fromEnv')}</Badge>}
        </p>
        <p className="truncate text-xs text-fg-subtle">{user.email}</p>
      </div>
      <dl className="flex gap-4 text-xs text-fg-subtle">
        <Count label={t('users.copies')} value={number(user.copies)} />
        <Count label={t('users.decks')} value={number(user.decks)} />
        <Count label={t('users.products')} value={number(user.products)} />
      </dl>
      <div className="text-right text-xs text-fg-subtle">
        <p>{t('users.joined', { date: date(user.createdAt) })}</p>
        <p>
          {user.lastSeenAt
            ? t('users.lastSeen', { date: date(user.lastSeenAt) })
            : t('users.neverSeen')}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={setRole.isPending}
        disabled={locked}
        title={
          locked
            ? user.id === me?.id
              ? t('users.cannotDemoteSelf')
              : t('users.cannotDemoteEnv')
            : undefined
        }
        onClick={() =>
          setRole.mutate(
            { id: user.id, role: isAdmin ? 'USER' : 'ADMIN' },
            {
              onSuccess: () =>
                toast.success(
                  t(isAdmin ? 'users.demoted' : 'users.promoted', { name: user.username }),
                ),
              onError: (e) => toast.error((e as Error).message),
            },
          )
        }
      >
        {isAdmin ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
        {t(isAdmin ? 'users.demote' : 'users.promote')}
      </Button>
    </li>
  );
}

const Count = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <dd className="font-mono text-sm tabular-nums text-fg">{value}</dd>
    <dt>{label}</dt>
  </div>
);

function SyncsTab() {
  const t = useTranslations('admin');
  const { data, isLoading } = useAdminOverview();
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.syncs.length) return <EmptyState icon={RefreshCw} title={t('syncs.none')} />;
  return (
    <ul className="space-y-2">
      {data.syncs.map((sync) => (
        <SyncRow key={sync.id} sync={sync} />
      ))}
    </ul>
  );
}

function SyncRow({ sync }: { sync: AdminSyncDto }) {
  const t = useTranslations('admin');
  const { date, number } = useFormat();
  const run = useRunSync();
  const failed = sync.lastStatus === 'ERROR';

  return (
    <li className="rounded-2xl border border-border bg-bg-elevated px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-sm">
            {sync.id}
            {failed && <Badge tone="danger">{t('syncs.failed')}</Badge>}
            {!sync.lastSyncAt && <Badge>{t('syncs.never')}</Badge>}
          </p>
          <p className="text-xs text-fg-subtle">
            {sync.lastSyncAt
              ? t('syncs.lastRun', { date: date(sync.lastSyncAt) })
              : t('syncs.neverHint')}
            {sync.count > 0 && ` · ${t('syncs.count', { count: number(sync.count) })}`}
          </p>
        </div>
        {sync.runnable && (
          <Button
            variant="secondary"
            size="sm"
            loading={run.isPending && run.variables === sync.id}
            // Une synchro dure des minutes et la réponse n'arrive qu'à la fin : l'infobulle
            // le dit, sans quoi un bouton qui tourne longtemps se lit comme un plantage.
            title={t('syncs.runHint')}
            onClick={() =>
              run.mutate(sync.id as AdminRunnableSync, {
                onSuccess: () => toast.success(t('syncs.done', { id: sync.id })),
                onError: (e) => toast.error((e as Error).message),
              })
            }
          >
            <RefreshCw className="size-4" /> {t('syncs.run')}
          </Button>
        )}
      </div>
      {/* L'erreur de la dernière tentative : c'est elle qu'on vient lire quand ça casse */}
      {failed && sync.lastError && (
        <p className="mt-2 rounded-lg bg-danger/10 px-2 py-1.5 font-mono text-[11px] break-words text-danger">
          {sync.lastError}
        </p>
      )}
    </li>
  );
}

function InstanceTab() {
  const t = useTranslations('admin');
  const { data, isLoading } = useAdminOverview();
  const { number } = useFormat();
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data) return null;
  const { counts, health } = data;

  return (
    <>
      <Figures>
        <Stat label={t('counts.users')} value={number(counts.users)} />
        <Stat label={t('counts.decks')} value={number(counts.decks)} />
        <Stat label={t('counts.copies')} value={number(counts.copies)} />
        <Stat label={t('counts.products')} value={number(counts.products)} />
      </Figures>
      <Figures>
        <Stat label={t('counts.cards')} value={number(counts.cards)} />
        <Stat label={t('counts.prints')} value={number(counts.prints)} />
        <Stat label={t('counts.sets')} value={number(counts.sets)} />
        <Stat label={t('counts.uploads')} value={formatBytes(counts.uploadsBytes)} />
      </Figures>
      <ul className="space-y-2">
        <HealthRow ok={health.database} label={t('health.database')} />
        <HealthRow ok={health.uploadsWritable} label={t('health.uploads')} />
        <HealthRow
          ok={health.duelData !== 'MISSING'}
          label={t('health.duel')}
          value={t(`health.duelData.${health.duelData}`)}
        />
        <HealthRow ok label={t('health.node')} value={health.nodeVersion} />
        <HealthRow ok label={t('health.uptime')} value={formatUptime(health.uptimeSeconds)} />
      </ul>
    </>
  );
}

function HealthRow({ ok, label, value }: { ok: boolean; label: string; value?: string }) {
  const Icon = ok ? Check : AlertTriangle;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm">
      <Icon className={cn('size-4 shrink-0', ok ? 'text-success' : 'text-warning')} aria-hidden />
      <span className="flex-1">{label}</span>
      {value && <span className="font-mono text-xs text-fg-subtle">{value}</span>}
    </li>
  );
}

/** Taille lisible. Pas de dépendance pour trois lignes, et les unités ne se traduisent pas. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
