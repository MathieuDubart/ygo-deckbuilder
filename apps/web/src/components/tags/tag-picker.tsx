'use client';
import { TAG_COLORS, type TagColor, type TagDto } from '@ygo/shared';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateTag, useTags } from '@/lib/api/tags';
import { cn } from '@/lib/utils';
import { TagChip, tagColorClass } from './tag-chip';

/**
 * Pose d'étiquettes sur une cible (carte ou extension) : les étiquettes existantes se
 * cochent, et on peut en créer une sans quitter le panneau — c'est au moment où on classe
 * qu'on sait de quelle étiquette on a besoin.
 */
export function TagPicker({
  attached,
  onToggle,
  label,
}: {
  attached: string[];
  onToggle: (tagId: string, on: boolean) => void;
  /** Libellé du bouton ; par défaut « Étiquettes ». */
  label?: string;
}) {
  const t = useTranslations('tags');
  const { data: tags } = useTags();
  const [open, setOpen] = useState(false);
  const create = useCreateTag();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('slate');
  const panel = useRef<HTMLDivElement>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tag = await create.mutateAsync({ name: trimmed, color }).catch(() => null);
    if (!tag) return;
    setName('');
    onToggle(tag.id, true);
  };

  return (
    <div
      className="relative"
      ref={panel}
      onBlur={(e) => {
        if (!panel.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <TagIcon className="size-3.5" /> {label ?? t('title')}
        {attached.length > 0 && (
          <span className="font-mono text-xs tabular-nums">{attached.length}</span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 space-y-3 rounded-xl border border-border bg-bg-elevated p-3 shadow-xl">
          {tags?.length ? (
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  active={attached.includes(tag.id)}
                  onClick={() => onToggle(tag.id, !attached.includes(tag.id))}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-fg-muted">{t('empty')}</p>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder={t('newPlaceholder')}
              maxLength={40}
              className="h-9"
            />
            <div className="flex items-center justify-between gap-2">
              <ColorPicker value={color} onChange={setColor} />
              <Button size="sm" onClick={() => void submit()} loading={create.isPending}>
                <Plus className="size-3.5" /> {t('create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
}) {
  const t = useTranslations('tags');
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t('color')}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'size-5 rounded-full border',
            tagColorClass(color),
            value === color && 'ring-2 ring-current ring-offset-1 ring-offset-bg-elevated',
          )}
        />
      ))}
    </div>
  );
}

/** Liste en lecture des étiquettes posées, pour les tuiles et les lignes de liste. */
export function TagList({
  tagIds,
  tags,
  className,
}: {
  tagIds: string[];
  tags?: TagDto[];
  className?: string;
}) {
  if (!tagIds.length || !tags?.length) return null;
  const attached = tags.filter((tag) => tagIds.includes(tag.id));
  if (!attached.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {attached.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
