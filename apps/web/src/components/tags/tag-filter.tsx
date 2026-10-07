'use client';
import { Tag as TagIcon, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDeleteTag, useTags } from '@/lib/api/tags';
import { TagChip } from './tag-chip';

/**
 * Filtre par étiquettes : on en cumule plusieurs pour restreindre (ET, pas OU — c'est ce
 * qu'on attend quand on empile des critères). Le mode « gérer » permet de supprimer une
 * étiquette devenue inutile, là où on la voit.
 */
export function TagFilter({
  value,
  onChange,
  /** Effectifs à afficher sur chaque pastille (cartes ou extensions selon l'onglet). */
  counts,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
  counts?: (tagId: string) => number | undefined;
}) {
  const t = useTranslations('tags');
  const { data: tags } = useTags();
  const remove = useDeleteTag();
  const [managing, setManaging] = useState(false);

  if (!tags?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TagIcon className="size-3.5 shrink-0 text-fg-subtle" />
      {tags.map((tag) =>
        managing ? (
          <TagChip
            key={tag.id}
            tag={tag}
            onRemove={() => {
              remove.mutate(tag.id);
              onChange(value.filter((id) => id !== tag.id));
            }}
          />
        ) : (
          <TagChip
            key={tag.id}
            tag={tag}
            active={value.includes(tag.id)}
            count={counts?.(tag.id)}
            onClick={() =>
              onChange(
                value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id],
              )
            }
          />
        ),
      )}
      {value.length > 0 && !managing && (
        <Button variant="ghost" size="sm" onClick={() => onChange([])}>
          {t('clear')}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setManaging((v) => !v)}
        aria-pressed={managing}
      >
        {managing ? t('done') : <Trash2 className="size-3.5" />}
        <span className={managing ? '' : 'sr-only'}>{managing ? '' : t('manage')}</span>
      </Button>
    </div>
  );
}
